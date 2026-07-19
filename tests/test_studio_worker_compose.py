from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMPOSE = ROOT / "deploy/studio/compose.platform.yml"
ENV = ROOT / "deploy/studio/.env.example"


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
    assert 'test: ["CMD", "python", "-m", "studio_api.worker_health"]' in worker
    assert "stop_grace_period: 86460s" in worker
    assert "postgres: { condition: service_healthy }" in worker
    deps = worker.split("depends_on:", 1)[1]
    assert "redis:" not in deps and "studio-api:" not in deps
    for key in ["STUDIO_WORKER_POLL_INTERVAL_SECONDS", "STUDIO_WORKER_ERROR_BACKOFF_SECONDS", "STUDIO_WORKER_LEASE_TTL_SECONDS"]:
        assert key in worker
    for secret in ["studio_postgres_password", "studio_credential_master_key", "studio_source_s3_access_key_id", "studio_source_s3_secret_access_key", "studio_google_oauth_client_secret"]:
        assert secret in worker
    assert text.rsplit("volumes:", 1)[1].count("studio-postgres-data:") == 1


def test_env_example_worker_defaults_once():
    text=ENV.read_text()
    for line in ["STUDIO_WORKER_POLL_INTERVAL_SECONDS=5", "STUDIO_WORKER_ERROR_BACKOFF_SECONDS=5", "STUDIO_WORKER_LEASE_TTL_SECONDS=3600"]:
        assert text.count(line) == 1
