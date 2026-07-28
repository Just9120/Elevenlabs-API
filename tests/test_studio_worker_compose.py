from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMPOSE = ROOT / "deploy/studio/compose.platform.yml"
ENV = ROOT / "deploy/studio/.env.example"
DOCKERFILE = ROOT / "apps/studio-api/Dockerfile"


def service_block(name):
    lines = COMPOSE.read_text().splitlines()
    start = next(i for i,l in enumerate(lines) if l == f"  {name}:")
    end = next((i for i in range(start+1,len(lines)) if lines[i].startswith("  ") and not lines[i].startswith("    ")), len(lines))
    return "\n".join(lines[start:end])


def test_studio_worker_compose_contract():
    text=COMPOSE.read_text(); worker=service_block("studio-worker"); api=service_block("studio-api")
    assert text.count("  studio-worker:") == 1
    assert "build: ../../apps/studio-api" in worker and "build: ../../apps/studio-api" in api
    assert "image: elevenlabs-studio-api:local" in api
    assert "image: elevenlabs-studio-worker:local" in worker
    assert 'command: ["python", "-m", "studio_api.worker"]' in worker
    assert "restart: unless-stopped" in worker
    assert "ports:" not in worker and "healthcheck:" in worker
    assert (
        'test: ["CMD", "python", "-m", "studio_api.container_entrypoint", '
        '"--drop-only", "python", "-m", "studio_api.worker_health"]'
    ) in worker
    assert "stop_grace_period: 86460s" in worker
    assert "postgres: { condition: service_healthy }" in worker
    deps = worker.split("depends_on:", 1)[1]
    assert "redis:" not in deps and "studio-api:" not in deps
    for key in ["STUDIO_WORKER_POLL_INTERVAL_SECONDS", "STUDIO_WORKER_ERROR_BACKOFF_SECONDS", "STUDIO_WORKER_LEASE_TTL_SECONDS", "STUDIO_WORKER_LEASE_HEARTBEAT_INTERVAL_SECONDS"]:
        assert key in worker
    for secret in ["studio_postgres_password", "studio_credential_master_key", "studio_source_s3_access_key_id", "studio_source_s3_secret_access_key", "studio_google_oauth_client_secret"]:
        assert secret in worker
    assert "STUDIO_GOOGLE_MAINTENANCE_OAUTH_" not in worker
    assert "studio_google_maintenance_oauth_client_secret" not in worker
    assert "STUDIO_GOOGLE_MAINTENANCE_OAUTH_CLIENT_ID" in api
    assert "studio_google_maintenance_oauth_client_secret" in api
    for service in (api, worker):
        assert 'user: "0:0"' in service
        assert "STUDIO_CONTAINER_SECRET_BOOTSTRAP: required" in service
        assert "/run/studio-runtime-secrets/studio_postgres_password" in service
        assert "/run/studio-runtime-secrets/studio_credential_master_key" in service
        assert "/run/studio-runtime-secrets:mode=0711,uid=0,gid=0" in service
        assert "_FILE: /run/secrets/" not in service
    assert text.rsplit("volumes:", 1)[1].count("studio-postgres-data:") == 1


def test_env_example_worker_defaults_once():
    text=ENV.read_text()
    for line in ["STUDIO_WORKER_POLL_INTERVAL_SECONDS=5", "STUDIO_WORKER_ERROR_BACKOFF_SECONDS=5", "STUDIO_WORKER_LEASE_TTL_SECONDS=3600"]:
        assert text.count(line) == 1


def test_heartbeat_config_is_worker_only():
    worker=service_block("studio-worker"); api=service_block("studio-api"); web=service_block("studio-web")
    assert "STUDIO_WORKER_LEASE_HEARTBEAT_INTERVAL_SECONDS" in worker
    assert "STUDIO_WORKER_LEASE_HEARTBEAT_INTERVAL_SECONDS: ${STUDIO_WORKER_LEASE_HEARTBEAT_INTERVAL_SECONDS:-60}" in worker
    assert "STUDIO_WORKER_LEASE_HEARTBEAT_INTERVAL_SECONDS" not in api
    assert "STUDIO_WORKER_LEASE_HEARTBEAT_INTERVAL_SECONDS" not in web


def test_compose_worker_heartbeat_default_supports_old_env():
    worker=service_block("studio-worker")
    assert "STUDIO_WORKER_LEASE_HEARTBEAT_INTERVAL_SECONDS is required" not in worker
    assert "${STUDIO_WORKER_LEASE_HEARTBEAT_INTERVAL_SECONDS:-60}" in worker


def test_shared_api_worker_image_installs_media_runtime_without_recommends():
    text = DOCKERFILE.read_text()
    assert "apt-get install -y --no-install-recommends ffmpeg" in text
    assert "rm -rf /var/lib/apt/lists/*" in text


def test_shared_api_worker_image_drops_root_before_runtime():
    lines=DOCKERFILE.read_text().splitlines()
    assert "groupadd --gid 10001 studio" in "\n".join(lines)
    assert "useradd --uid 10001 --gid studio --no-create-home" in "\n".join(lines)
    user_index=lines.index("USER 10001:10001")
    assert user_index > next(i for i,line in enumerate(lines) if line == "COPY . .")
    assert (
        'ENTRYPOINT ["python", "-m", "studio_api.container_entrypoint"]'
        in lines[user_index + 1 :]
    )
    assert user_index < next(i for i,line in enumerate(lines) if line.startswith("CMD "))
    assert not any(line == "USER root" for line in lines[user_index + 1:])
