from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
HOST_NGINX = ROOT / "deploy/studio/studio.librechat.online.nginx.conf"
CONTAINER_NGINX = ROOT / "apps/studio/nginx.conf"


def _normalized_config(path: Path) -> str:
    return " ".join(path.read_text(encoding="utf-8").split())


def test_public_host_owns_complete_browser_security_header_policy():
    config = _normalized_config(HOST_NGINX)
    required_headers = [
        "Content-Security-Policy",
        "Strict-Transport-Security",
        "X-Content-Type-Options",
        "Referrer-Policy",
        "Permissions-Policy",
        "X-Frame-Options",
    ]
    for header in required_headers:
        assert len(re.findall(rf"add_header {re.escape(header)} ", config, re.IGNORECASE)) == 1
        assert re.search(rf"add_header {re.escape(header)} .*? always;", config, re.IGNORECASE)

    assert "location /api/" in config and "location /" in config
    assert config.index("add_header Content-Security-Policy") < config.index("location /api/")
    assert "proxy_hide_header Cache-Control" not in config
    assert "proxy_hide_header Pragma" not in config


def test_csp_is_picker_compatible_without_script_wildcards_or_eval():
    config = _normalized_config(HOST_NGINX)
    match = re.search(r'add_header Content-Security-Policy "([^"]+)" always;', config)
    assert match
    csp = match.group(1)
    directives = {
        parts[0]: parts[1:]
        for raw in csp.split(";")
        if (parts := raw.strip().split())
    }

    assert directives["default-src"] == ["'self'"]
    assert directives["base-uri"] == ["'none'"]
    assert directives["object-src"] == ["'none'"]
    assert directives["frame-ancestors"] == ["'none'"]
    assert directives["script-src"] == [
        "'self'",
        "https://apis.google.com",
        "https://www.gstatic.com",
    ]
    assert "'unsafe-eval'" not in csp
    assert "*" not in directives["script-src"]
    assert directives["frame-src"] == [
        "https://docs.google.com",
        "https://drive.google.com",
        "https://accounts.google.com",
    ]
    assert directives["connect-src"] == ["'self'", "https:"]
    assert directives["worker-src"] == ["'self'", "blob:"]
    assert directives["manifest-src"] == ["'self'"]
    assert "upgrade-insecure-requests" in directives


def test_internal_static_container_does_not_compete_with_host_policy():
    container_config = _normalized_config(CONTAINER_NGINX)
    assert "Content-Security-Policy" not in container_config
    assert "Strict-Transport-Security" not in container_config
