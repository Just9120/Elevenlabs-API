from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
HOST_NGINX = ROOT / "deploy/studio/studio.librechat.online.nginx.conf"
HOST_HEADERS = ROOT / "deploy/studio/studio-security-headers.conf"
CONTAINER_NGINX = ROOT / "apps/studio/nginx.conf"


def _normalized_config(path: Path) -> str:
    return " ".join(path.read_text(encoding="utf-8").split())


def test_public_host_owns_complete_browser_security_header_policy():
    site_config = _normalized_config(HOST_NGINX)
    config = _normalized_config(HOST_HEADERS)
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

    assert (
        "include /etc/nginx/snippets/studio-security-headers.conf;"
        in site_config
    )
    assert not re.search(r"add_header\s+", site_config, re.IGNORECASE)
    assert "location /api/" in site_config and "location /" in site_config
    assert "proxy_hide_header Cache-Control" not in site_config
    assert "proxy_hide_header Pragma" not in site_config


def test_public_referrer_policy_exposes_only_origin_for_google_picker():
    config = _normalized_config(HOST_HEADERS)

    assert len(re.findall(r"add_header Referrer-Policy ", config, re.IGNORECASE)) == 1
    assert 'add_header Referrer-Policy "origin" always;' in config
    assert 'add_header Referrer-Policy "no-referrer"' not in config


def test_yandex_realtime_relay_upgrades_without_logging_signed_capability():
    config = _normalized_config(HOST_NGINX)
    match = re.search(
        r"location = /api/realtime/yandex \{(.*?)\}",
        config,
    )
    assert match
    relay = match.group(1)
    assert "access_log off;" in relay
    assert "proxy_http_version 1.1;" in relay
    assert "proxy_set_header Upgrade $http_upgrade;" in relay
    assert 'proxy_set_header Connection "upgrade";' in relay
    assert "proxy_read_timeout 360s;" in relay


def test_csp_is_picker_compatible_without_script_wildcards_or_eval():
    config = _normalized_config(HOST_HEADERS)
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
    assert directives["connect-src"] == [
        "'self'",
        "https:",
        "wss://api.elevenlabs.io",
    ]
    assert directives["worker-src"] == ["'self'", "blob:"]
    assert directives["manifest-src"] == ["'self'"]
    assert "upgrade-insecure-requests" in directives


def test_permissions_policy_allows_only_same_origin_realtime_capture():
    config = _normalized_config(HOST_HEADERS)
    match = re.search(r'add_header Permissions-Policy "([^"]+)" always;', config)
    assert match
    policy = match.group(1)

    assert "microphone=(self)" in policy
    assert "display-capture=(self)" in policy
    assert "camera=()" in policy
    assert "geolocation=()" in policy
    assert "microphone=*" not in policy
    assert "display-capture=*" not in policy


def test_internal_static_container_does_not_compete_with_host_policy():
    container_config = _normalized_config(CONTAINER_NGINX)
    assert "Content-Security-Policy" not in container_config
    assert "Strict-Transport-Security" not in container_config


def test_internal_static_container_serves_webmanifest_with_standard_media_type():
    container_config = _normalized_config(CONTAINER_NGINX)
    manifest_location = re.search(
        r"location = /manifest\.webmanifest \{(.*?)\}",
        container_config,
    )

    assert manifest_location
    manifest_config = manifest_location.group(1)
    assert "default_type application/manifest+json;" in manifest_config
    assert "try_files $uri =404;" in manifest_config
    assert "add_header Content-Type" not in manifest_config
