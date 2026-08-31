from pathlib import Path

import yaml

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
    assert "context: ../../apps/studio-api" in worker and "context: ../../apps/studio-api" in api
    assert "STUDIO_COMPONENT: worker" in worker and "STUDIO_COMPONENT: api" in api
    assert "STUDIO_COMMIT_SHA: ${STUDIO_RELEASE_SHA:-unknown}" in worker
    assert "image: elevenlabs-studio-api:local" in api
    assert "image: elevenlabs-studio-worker:local" in worker
    assert 'command: ["python", "-m", "studio_api.worker"]' in worker
    assert "restart: unless-stopped" in worker
    assert "ports:" not in worker and "healthcheck:" in worker
    assert (
        'test: ["CMD", "python", "-m", "studio_api.container_entrypoint", '
        '"--drop-only", "python", "-m", "studio_api.worker_health", "--mode", "readiness"]'
    ) in worker
    assert "stop_grace_period: 86460s" in worker
    assert "postgres: { condition: service_healthy }" in worker
    deps = worker.split("depends_on:", 1)[1]
    assert "redis:" not in deps and "studio-api:" not in deps
    for key in ["STUDIO_WORKER_POLL_INTERVAL_SECONDS", "STUDIO_WORKER_ERROR_BACKOFF_SECONDS", "STUDIO_WORKER_LEASE_TTL_SECONDS", "STUDIO_WORKER_LEASE_HEARTBEAT_INTERVAL_SECONDS"]:
        assert key in worker
    for secret in ["studio_postgres_password", "studio_credential_master_key", "studio_source_s3_access_key_id", "studio_source_s3_secret_access_key", "studio_audio_reference_s3_access_key_id", "studio_audio_reference_s3_secret_access_key", "studio_google_oauth_client_secret"]:
        assert secret in worker
    assert "STUDIO_GOOGLE_MAINTENANCE_OAUTH_CLIENT_ID" in worker
    assert "STUDIO_GOOGLE_MAINTENANCE_OAUTH_CLIENT_SECRET_FILE" in worker
    assert "STUDIO_GOOGLE_MAINTENANCE_OAUTH_SCOPES" in worker
    assert "studio_google_maintenance_oauth_client_secret" in worker
    assert "STUDIO_GOOGLE_MAINTENANCE_OAUTH_CLIENT_ID" in api
    assert "studio_google_maintenance_oauth_client_secret" in api
    for service in (api, worker):
        assert 'user: "0:0"' in service
        assert "STUDIO_CONTAINER_SECRET_BOOTSTRAP: required" in service
        assert "/run/studio-runtime-secrets/studio_postgres_password" in service
        assert "/run/studio-runtime-secrets/studio_credential_master_key" in service
        assert "/run/studio-runtime-secrets:mode=0711,uid=0,gid=0" in service
        assert "_FILE: /run/secrets/" not in service
        assert "STUDIO_AUDIO_PREPARATION_MAX_OUTPUT_BYTES: ${STUDIO_AUDIO_PREPARATION_MAX_OUTPUT_BYTES:-2147483647}" in service
        assert "STUDIO_SOURCE_S3_LIFECYCLE_RULE_ID" in service
        assert "STUDIO_AUDIO_REFERENCE_S3_BUCKET" in service
        assert "STUDIO_AUDIO_REFERENCE_S3_ACCESS_KEY_ID_FILE" in service
        assert "STUDIO_AUDIO_REFERENCE_S3_SECRET_ACCESS_KEY_FILE" in service
        assert "STUDIO_AUDIO_REFERENCE_S3_LIFECYCLE_RULE_ID" in service
    assert text.rsplit("volumes:", 1)[1].count("studio-postgres-data:") == 1


def test_worker_has_explicit_resource_and_process_isolation():
    worker = service_block("studio-worker")
    assert "read_only: true" in worker
    assert "cap_drop: [ALL]" in worker
    assert "cap_add: [CHOWN, SETGID, SETUID]" in worker
    assert "security_opt: [no-new-privileges:true]" in worker
    assert 'cpus: "${STUDIO_WORKER_CPU_LIMIT:-2.0}"' in worker
    assert "mem_limit: ${STUDIO_WORKER_MEMORY_LIMIT:-4g}" in worker
    assert "memswap_limit: ${STUDIO_WORKER_MEMORY_SWAP_LIMIT:-4g}" in worker
    assert "pids_limit: ${STUDIO_WORKER_PIDS_LIMIT:-256}" in worker
    assert "PYTHONDONTWRITEBYTECODE: \"1\"" in worker
    assert "TMPDIR: /tmp" in worker
    assert "/tmp:rw,nosuid,nodev,noexec,mode=1770,uid=10001,gid=10001,size=${STUDIO_WORKER_TMPFS_SIZE:-3g}" in worker


def test_worker_networks_are_disjoint_from_web_api_and_redis():
    text = COMPOSE.read_text()
    worker = service_block("studio-worker")
    api = service_block("studio-api")
    web = service_block("studio-web")
    postgres = service_block("postgres")
    redis = service_block("redis")
    assert "studio-worker-db" in worker and "studio-worker-egress" in worker
    for forbidden in ("studio-web-api", "studio-api-db", "studio-api-cache", "studio-api-egress"):
        assert forbidden not in worker
    assert "studio-web-api" in web and "studio-web-api" in api
    assert "studio-api-db" in api and "studio-api-cache" in api and "studio-api-egress" in api
    assert "studio-worker-db" in postgres and "studio-api-db" in postgres
    assert "studio-api-cache" in redis and "studio-worker" not in redis
    networks = text.split("\nnetworks:\n", 1)[1]
    for internal in ("studio-web-api", "studio-api-db", "studio-api-cache", "studio-worker-db"):
        assert f"  {internal}:\n    internal: true" in networks
    assert "  studio-api-egress:" in networks
    assert "  studio-worker-egress:" in networks


def test_web_has_a_private_host_publish_network_without_relaxing_internal_networks():
    config = yaml.safe_load(COMPOSE.read_text())
    services = config["services"]
    web = services["studio-web"]
    assert web["ports"] == ["127.0.0.1:8181:8080"]
    assert set(web["networks"]) == {"studio-web-api", "studio-web-ingress"}
    assert config["networks"]["studio-web-ingress"] == {"driver": "bridge", "internal": False}
    for name, service in services.items():
        if name != "studio-web":
            assert "studio-web-ingress" not in service.get("networks", [])
    for name in ("studio-web-api", "studio-api-db", "studio-api-cache", "studio-worker-db"):
        assert config["networks"][name]["internal"] is True


def test_worker_uses_dedicated_database_login_and_secret_source():
    text = COMPOSE.read_text()
    worker = service_block("studio-worker")
    api = service_block("studio-api")
    assert "STUDIO_DATABASE_USER: studio_worker" in worker
    assert "STUDIO_DATABASE_USER: studio" in api
    assert "source: studio_worker_postgres_password" in worker
    assert "target: studio_postgres_password" in worker
    assert "studio_worker_postgres_password:" in text
    assert "STUDIO_WORKER_POSTGRES_PASSWORD_FILE:?worker database secret file required" in text


def test_env_example_worker_defaults_once():
    text=ENV.read_text()
    for line in ["STUDIO_WORKER_POLL_INTERVAL_SECONDS=5", "STUDIO_WORKER_ERROR_BACKOFF_SECONDS=5", "STUDIO_WORKER_LEASE_TTL_SECONDS=3600"]:
        assert text.count(line) == 1
    assert text.count("STUDIO_AUDIO_PREPARATION_MAX_OUTPUT_BYTES=2147483647") == 1
    for line in [
        "STUDIO_WORKER_POSTGRES_PASSWORD_FILE=/path/to/studio_worker_postgres_password",
        "STUDIO_WORKER_CPU_LIMIT=2.0",
        "STUDIO_WORKER_MEMORY_LIMIT=4g",
        "STUDIO_WORKER_MEMORY_SWAP_LIMIT=4g",
        "STUDIO_WORKER_PIDS_LIMIT=256",
        "STUDIO_WORKER_TMPFS_SIZE=3g",
    ]:
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
    copy_index=lines.index("COPY . .")
    permission_index=lines.index("RUN chmod -R u=rwX,go=rX /app")
    assert copy_index < permission_index < user_index
    assert (
        'ENTRYPOINT ["python", "-m", "studio_api.container_entrypoint"]'
        in lines[user_index + 1 :]
    )
    assert user_index < next(i for i,line in enumerate(lines) if line.startswith("CMD "))
    assert not any(line == "USER root" for line in lines[user_index + 1:])
