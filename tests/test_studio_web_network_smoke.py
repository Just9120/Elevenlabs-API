import copy
from pathlib import Path
import runpy

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[1]
build = runpy.run_path(str(ROOT / "tests/support/studio_web_network_smoke.py"))["smoke_definition"]


def rendered():
    config = yaml.safe_load((ROOT / "deploy/studio/compose.platform.yml").read_text())
    config["services"]["studio-web"]["ports"] = [
        {"host_ip": "127.0.0.1", "published": "8181", "target": 8080, "protocol": "tcp"}
    ]
    for name, network in config["networks"].items():
        if network is not None:
            network["name"] = "elevenlabs-studio-platform_" + name
    return config


def test_smoke_uses_real_web_topology_but_never_production_names_or_services():
    original = rendered()
    before = copy.deepcopy(original)
    config = build(original, "studio-web-smoke-abcdef123456", "synthetic-image")
    assert original == before
    assert set(config["services"]) == {"studio-web"}
    web = config["services"]["studio-web"]
    assert web["image"] == "synthetic-image" and web["restart"] == "no"
    assert web["ports"][0]["published"] == "0" and web["ports"][0]["host_ip"] == "127.0.0.1"
    assert set(web["networks"]) == set(original["services"]["studio-web"]["networks"])
    assert config["networks"]["studio-web-api"]["internal"] is True
    assert config["networks"]["studio-web-ingress"]["internal"] is False
    assert all("name" not in network for network in config["networks"].values())
    for forbidden in ("build", "depends_on", "secrets", "volumes", "environment"):
        assert forbidden not in web


@pytest.mark.parametrize("change", ["project", "public_binding", "external_network", "target"])
def test_smoke_rejects_unsafe_scope_or_changed_publication_contract(change):
    config = rendered()
    project = "studio-web-smoke-abcdef123456"
    if change == "project":
        project = "elevenlabs-studio-platform"
    elif change == "public_binding":
        config["services"]["studio-web"]["ports"][0]["host_ip"] = "0.0.0.0"
    elif change == "target":
        config["services"]["studio-web"]["ports"][0]["target"] = 80
    else:
        config["networks"]["studio-web-api"]["external"] = True
    with pytest.raises(ValueError):
        build(config, project, "synthetic-image")


def test_existing_ci_job_runs_actual_web_host_smoke_after_image_build():
    workflow = yaml.safe_load((ROOT / ".github/workflows/studio-ci.yml").read_text())
    steps = workflow["jobs"]["studio"]["steps"]
    build_index = next(i for i, step in enumerate(steps) if step.get("name") == "Build Studio web image")
    smoke_index = next(i for i, step in enumerate(steps) if step.get("name") == "Verify web host port publication")
    assert smoke_index > build_index
    assert steps[smoke_index]["run"] == "python tests/support/studio_web_network_smoke.py"
    assert "continue-on-error" not in steps[smoke_index]
