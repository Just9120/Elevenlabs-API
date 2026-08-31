"""Secretless Docker smoke for the actual web network/host-publication contract.

Uses only the CI-built image and a unique disposable web-only Compose project.
Never loads production .env, starts dependencies, or changes existing networks.
"""
from __future__ import annotations

import copy
import json
from pathlib import Path
import re
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[2]


def smoke_definition(rendered: dict, project: str, image: str) -> dict:
    if not re.fullmatch(r"studio-web-smoke-[a-f0-9]{12}", project):
        raise ValueError("unsafe smoke project name")
    web = rendered["services"]["studio-web"]
    ports = web["ports"]
    if len(ports) != 1 or not (
        ports[0]["host_ip"] == "127.0.0.1"
        and str(ports[0]["published"]) == "8181"
        and ports[0]["target"] == 8080
        and ports[0].get("protocol", "tcp") == "tcp"
    ):
        raise ValueError("production web must publish only loopback 8181:8080")
    networks = {}
    for name in web["networks"]:
        network = rendered["networks"][name]
        if network.get("external") or network.get("driver", "bridge") != "bridge":
            raise ValueError("smoke requires private project-owned bridge networks")
        # Deliberately do not copy resolved production network names/IPAM.
        networks[name] = {"driver": "bridge", "internal": network.get("internal", False)}
    smoke_ports = copy.deepcopy(ports)
    smoke_ports[0]["published"] = "0"  # Dynamic loopback port, no CI host conflict.
    return {
        "name": project,
        "services": {"studio-web": {
            "image": image, "restart": "no", "ports": smoke_ports,
            "networks": list(networks),
            "healthcheck": copy.deepcopy(web["healthcheck"]),
        }},
        "networks": networks,
    }


def run(*args: str) -> str:
    return subprocess.run(args, check=True, capture_output=True, text=True, timeout=60).stdout.strip()


def main() -> None:
    rendered = json.loads(run(
        "docker", "compose", "--env-file", str(ROOT / "deploy/studio/.env.example"),
        "-f", str(ROOT / "deploy/studio/compose.platform.yml"), "config", "--format", "json",
    ))
    image = run("docker", "image", "inspect", "--format", "{{.Id}}", "elevenlabs-studio-web:test")
    if not re.fullmatch(r"sha256:[a-f0-9]{64}", image):
        raise RuntimeError("CI-built web image identity unavailable")
    project = "studio-web-smoke-" + uuid.uuid4().hex[:12]
    definition = smoke_definition(rendered, project, image)
    with tempfile.TemporaryDirectory(prefix="studio-web-smoke-") as directory:
        config = Path(directory) / "compose.json"
        config.write_text(json.dumps(definition), encoding="utf-8")
        compose = ("docker", "compose", "--project-name", project, "-f", str(config))
        try:
            run(*compose, "up", "--detach", "--no-deps", "--no-build", "--pull", "never", "studio-web")
            container = run(*compose, "ps", "-q", "studio-web")
            if not re.fullmatch(r"[a-f0-9]{64}", container):
                raise RuntimeError("expected one running smoke web container")
            metadata = json.loads(run("docker", "inspect", container))[0]
            if metadata["Image"] != image:
                raise RuntimeError("smoke web image identity mismatch")
            bindings = metadata["NetworkSettings"]["Ports"].get("8080/tcp")
            if not bindings or len(bindings) != 1 or bindings[0]["HostIp"] != "127.0.0.1":
                raise RuntimeError("actual loopback web port was not published")
            port = int(bindings[0]["HostPort"])
            if not 1 <= port <= 65535:
                raise RuntimeError("invalid published web port")
            endpoint = f"http://127.0.0.1:{port}/healthz"
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
            deadline = time.monotonic() + 30
            while True:
                try:
                    with opener.open(endpoint, timeout=1) as response:
                        if response.status == 200 and response.read(32).strip() == b"ok":
                            break
                except (urllib.error.URLError, TimeoutError):
                    pass
                if time.monotonic() >= deadline:
                    raise RuntimeError("web is not reachable from the Docker host")
                time.sleep(0.5)
        finally:
            # Safe: this exact generated config has one disposable container,
            # unique project-owned networks, no volumes, and no dependencies.
            run(*compose, "down", "--timeout", "5")
    print("STUDIO_WEB_HOST_PUBLICATION_OK")


if __name__ == "__main__":
    main()
