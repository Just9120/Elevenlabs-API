"""Full synthetic API/web/worker upgrade + compatible rollback rehearsal.

Only immutable Git revisions, owned tmpfs containers and an internal Docker
network are accepted. No production target, secret/config file, published port,
provider call or existing deployment is used. Builds require network; running
application containers cannot reach the internet. Run once for release evidence,
not on every CI push. Production restore/rollback remains an operator procedure.
"""
import argparse
import io
import json
import re
import subprocess
import sys
import tarfile
import tempfile
import time
import uuid
from pathlib import Path

from rehearse_studio_restore import OwnedNetwork, OwnedPostgres, DrillFailure, _run, LABEL

ROOT = Path(__file__).resolve().parents[1]
SHA = re.compile(r"^[a-f0-9]{40}$")
IMAGE = re.compile(r"^sha256:[a-f0-9]{64}$")


def export_revision(revision, destination):
    if not SHA.fullmatch(revision):
        raise DrillFailure("release_revision_not_immutable")
    resolved = _run(["git", "-C", str(ROOT), "rev-parse", f"{revision}^{{commit}}"], timeout=10).decode().strip()
    if resolved != revision:
        raise DrillFailure("release_revision_identity_mismatch")
    archive = _run(["git", "-C", str(ROOT), "archive", "--format=tar", revision], timeout=20)
    with tarfile.open(fileobj=io.BytesIO(archive)) as bundle:
        for item in bundle.getmembers():
            path = Path(item.name)
            if path.is_absolute() or ".." in path.parts or item.issym() or item.islnk() or not (item.isfile() or item.isdir()):
                raise DrillFailure("release_archive_path_invalid")
        bundle.extractall(destination, filter="data")


class OwnedReleaseContainer:
    def __init__(self, image_id, nonce, role, network, *, user="10001:10001", drop_privileges=False):
        if not IMAGE.fullmatch(image_id):
            raise DrillFailure("release_image_identity_invalid")
        self.image_id, self.nonce, self.role, self.network, self.user = image_id, nonce, role, network, user
        if drop_privileges and (role not in {"api", "worker"} or user != "0:0"):
            raise DrillFailure("release_privilege_drop_role_invalid")
        self.drop_privileges = drop_privileges
        self.container_id = None
        self.name = f"studio-release-{nonce}-{role}"

    def verify(self):
        self.network.verify()
        if not self.container_id or not re.fullmatch(r"[a-f0-9]{64}", self.container_id):
            raise DrillFailure("release_container_identity_invalid")
        row = json.loads(_run(["docker", "inspect", self.container_id]))[0]
        host = row["HostConfig"]
        capabilities = {value.removeprefix("CAP_") for value in (host.get("CapAdd") or [])}
        if (row["Image"] != self.image_id or row["Name"] != "/" + self.name or
            row["Config"].get("Labels", {}).get(LABEL) != self.nonce or row["Config"].get("User") != self.user or
            host["NetworkMode"] != self.network.name or not host["ReadonlyRootfs"] or
            host.get("Binds") or host.get("PortBindings") or "ALL" not in host.get("CapDrop", []) or
            capabilities != ({"SETUID", "SETGID"} if self.drop_privileges else set()) or
            not any(item.startswith("no-new-privileges") for item in host.get("SecurityOpt", [])) or
            any(mount.get("Type") != "tmpfs" for mount in row.get("Mounts", []))):
            raise DrillFailure("release_container_boundary_invalid")
        return row

    def start(self, *, env=None, command=None, entrypoint=None):
        args = ["docker", "create", "--pull=never", "--name", self.name, "--label", f"{LABEL}={self.nonce}",
            "--network", self.network.name, "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
            "--user", self.user, "--memory", "768m", "--cpus", "1", "--pids-limit", "128",
            "--tmpfs", "/tmp:rw,size=67108864,mode=1777"]
        if self.drop_privileges:
            args += ["--cap-add", "SETUID", "--cap-add", "SETGID"]
        if self.role == "redis":
            args += ["--tmpfs", "/data:rw,size=16777216,uid=999,gid=999,mode=0700"]
        if self.role.endswith("web"):
            args += ["--tmpfs", "/var/cache/nginx:rw,size=16777216,uid=101,gid=101,mode=0700",
                     "--tmpfs", "/var/run:rw,size=1048576,uid=101,gid=101,mode=0700"]
        for key, value in (env or {}).items():
            args += ["--env", f"{key}={value}"]
        if entrypoint:
            args += ["--entrypoint", entrypoint]
        args += [self.image_id, *(command or [])]
        try:
            self.container_id = _run(args).decode().strip()
        except DrillFailure:
            # A create timeout can leave a container. Recover only the exact
            # nonce/name and validate before any removal.
            row = json.loads(_run(["docker", "inspect", self.name]))[0]
            self.container_id = row["Id"]
            self.network.containers.add(self.container_id)
            self.verify()
            raise
        self.network.containers.add(self.container_id)
        self.verify()
        _run(["docker", "start", self.container_id])

    def exec(self, command, *, timeout=20):
        self.verify()
        if self.drop_privileges:
            command = ["python", "-m", "studio_api.container_entrypoint", "--drop-only", *command]
        try:
            result = subprocess.run(["docker", "exec", self.container_id, *command], capture_output=True, timeout=timeout)
        except (OSError, subprocess.TimeoutExpired):
            raise DrillFailure(f"{self.role}_probe_unavailable_or_timeout") from None
        if result.returncode:
            # Expose only documented worker-health enums, never command text,
            # traceback, environment, fixture contents or credentials.
            match = re.search(rb"STUDIO_WORKER_HEALTH_FAIL reason=([a-z_]+)", result.stderr)
            allowed = {b"invalid_mode", b"pid1_not_worker", b"runtime_identity_invalid",
                       b"configuration_invalid", b"runtime_heartbeat_unavailable", b"dependency_unavailable"}
            reason = match[1].decode() if match and match[1] in allowed else f"exit_{result.returncode}"
            raise DrillFailure(f"{self.role}_probe_{reason}")
        if len(result.stdout) > 64 * 1024 * 1024:
            raise DrillFailure("release_probe_output_budget_exceeded")
        return result.stdout

    def close(self):
        if self.container_id:
            self.verify()
            _run(["docker", "stop", "--time", "20", self.container_id], timeout=25)
            row = self.verify()
            # Active worker must drain cleanly before any schema/config switch.
            if self.role.endswith("worker") and row["State"].get("ExitCode") != 0:
                raise DrillFailure("release_worker_drain_failed")
            _run(["docker", "rm", self.container_id])
            self.network.containers.discard(self.container_id)
            self.container_id = None


BOOT = """import os,sys,pathlib,base64
if os.geteuid()==0:
 os.setgroups([]);os.setgid(10001);os.setuid(10001)
d=pathlib.Path('/tmp/studio-release-secrets');d.mkdir(mode=0o700)
for name,value in [('pg',os.environ.pop('DRILL_PASSWORD')),('key',base64.b64encode(b'r'*32).decode())]:
 p=d/name;p.write_text(value);p.chmod(0o600)
os.environ['STUDIO_POSTGRES_PASSWORD_FILE']=str(d/'pg')
os.environ['STUDIO_CREDENTIAL_MASTER_KEY_FILE']=str(d/'key')
os.execvp(sys.executable,[sys.executable,*sys.argv[1:]])
"""


def application_env(database, redis, *, role, password):
    return {"STUDIO_ENVIRONMENT": "test", "STUDIO_DATABASE_HOST": database.name if hasattr(database, "name") else f"studio-recovery-{database.nonce}-{database.role}",
        "STUDIO_DATABASE_NAME": "studio_drill", "STUDIO_DATABASE_USER": role, "DRILL_PASSWORD": password,
        "STUDIO_POSTGRES_PASSWORD_FILE": "/tmp/studio-release-secrets/pg",
        "STUDIO_CREDENTIAL_MASTER_KEY_FILE": "/tmp/studio-release-secrets/key",
        "STUDIO_REDIS_URL": f"redis://{redis.name}:6379/0", "STUDIO_APP_ORIGIN": "https://studio.example.test",
        "STUDIO_RUNTIME_WORKER_HEARTBEAT_INTERVAL_SECONDS": "5", "STUDIO_WORKER_POLL_INTERVAL_SECONDS": "1"}


def build_images(tree, revision, nonce, artifact_tags):
    images = {}
    for component in ("api", "worker", "web"):
        print(f"release_phase=build component={component} revision={revision}", file=sys.stderr, flush=True)
        tag = f"studio-release-drill:{nonce}-{revision[:12]}-{component}"
        artifact_tags.append(tag)
        directory = tree / "apps" / ("studio" if component == "web" else "studio-api")
        _run(["docker", "build", "--label", f"{LABEL}={nonce}", "--tag", tag,
            "--build-arg", f"STUDIO_COMMIT_SHA={revision}", "--build-arg", f"STUDIO_COMPONENT={component}",
            "--build-arg", f"STUDIO_RELEASE_VERSION=synthetic-{revision[:12]}", str(directory)], timeout=600)
        image_id = _run(["docker", "image", "inspect", tag, "--format", "{{.Id}}"] ).decode().strip()
        if not IMAGE.fullmatch(image_id):
            raise DrillFailure("release_built_image_identity_invalid")
        images[component] = (tag, image_id)
    return images


def migration(images, revision, network, database, redis, password, target):
    container = OwnedReleaseContainer(images["api"][1], network.nonce, "migration", network)
    try:
        container.start(env=application_env(database, redis, role="studio_drill", password=password),
            entrypoint="python", command=["-c", BOOT, "-m", "alembic", "upgrade" if target == "head" else "downgrade", target])
        result = _run(["docker", "wait", container.container_id], timeout=120).decode().strip()
        if result != "0":
            raise DrillFailure("release_migration_failed")
    finally:
        container.close()


def start_release(images, revision, network, database, redis, password):
    containers = []
    try:
        for component in ("api", "worker", "web"):
            container = OwnedReleaseContainer(images[component][1], network.nonce, component, network,
                user="101:101" if component == "web" else "0:0", drop_privileges=component != "web")
            containers.append(container)
            if component == "web":
                container.start(entrypoint="nginx", command=["-g", "daemon off;"])
            else:
                command = ["-m", "uvicorn", "studio_api.main:app", "--host", "0.0.0.0", "--port", "8000"] if component == "api" else ["-m", "studio_api.worker"]
                container.start(env=application_env(database, redis, role=f"studio_{component}", password=password),
                    entrypoint="python", command=["-c", BOOT, *command])
        deadline = time.monotonic() + 45
        while True:
            check = "api_readiness"
            try:
                response = containers[0].exec(["python", "-c",
                    "import json,urllib.request; r=json.load(urllib.request.urlopen('http://127.0.0.1:8000/api/readyz',timeout=2)); assert r['ok'] is True; print(r['schema_revision'])"])
                check = "worker_readiness"
                containers[1].exec(["python", "-m", "studio_api.worker_health", "--mode", "readiness"])
                check = "web_identity"
                meta = json.loads(containers[2].exec(["wget", "-qO-", "http://127.0.0.1:8080/build-meta.json"]))
                if meta.get("commit_sha") != revision or meta.get("component") != "web":
                    raise DrillFailure("release_web_identity_mismatch")
                for container in containers[:2]:
                    check = f"{container.role}_identity"
                    container.exec(["python", "-c",
                        "from pathlib import Path; s=dict(line.split(':',1) for line in Path('/proc/1/status').read_text().splitlines() if ':' in line); assert s['Uid'].split()==['10001']*4 and s['Gid'].split()==['10001']*4 and not s['Groups'].split() and int(s['CapEff'].strip(),16)==0"])
                    baked = container.exec(["python", "-c", "import os,json;print(json.dumps({k:os.environ[k] for k in ['STUDIO_RUNTIME_COMMIT_SHA','STUDIO_RUNTIME_COMPONENT']}))"])
                    identity = json.loads(baked)
                    if identity["STUDIO_RUNTIME_COMMIT_SHA"] != revision or identity["STUDIO_RUNTIME_COMPONENT"] != container.role:
                        raise DrillFailure("release_runtime_identity_mismatch")
                return containers, response.decode().strip()
            except DrillFailure as error:
                if time.monotonic() >= deadline:
                    raise DrillFailure(f"{check}:{error}") from None
                time.sleep(1)
    except Exception:
        for container in reversed(containers):
            container.close()
        raise


def apply_roles(database, tree, *, password):
    database.sql((tree / "deploy/studio/database-roles.sql").read_bytes().replace(b"DATABASE studio TO", b"DATABASE studio_drill TO"))
    database.sql((tree / "deploy/studio/worker-db-role.sql").read_bytes().replace(b"DATABASE studio TO", b"DATABASE studio_drill TO"))
    database.sql(f"ALTER ROLE studio_api LOGIN PASSWORD '{password}'; ALTER ROLE studio_worker LOGIN PASSWORD '{password}';".encode())


def rehearse(*, baseline, candidate):
    if baseline == candidate or not SHA.fullmatch(baseline) or not SHA.fullmatch(candidate):
        raise DrillFailure("release_revision_pair_invalid")
    nonce = uuid.uuid4().hex
    network = OwnedNetwork(nonce)
    pg_image = _run(["docker", "image", "inspect", "postgres:17", "--format", "{{.Id}}"] ).decode().strip()
    redis_image = _run(["docker", "image", "inspect", "redis:7-alpine", "--format", "{{.Id}}"] ).decode().strip()
    database = OwnedPostgres(pg_image, nonce, "release", network)
    redis = OwnedReleaseContainer(redis_image, nonce, "redis", network, user="999:999")
    releases, containers, artifact_tags = [], [], []
    started = time.monotonic()
    phase = "build"
    try:
        with tempfile.TemporaryDirectory(prefix="studio-release-rehearsal-") as temporary:
            trees = []
            for revision in (baseline, candidate):
                tree = Path(temporary) / revision
                tree.mkdir(); export_revision(revision, tree); trees.append(tree)
                releases.append(build_images(tree, revision, nonce, artifact_tags))
            phase = "isolated_services"
            print(f"release_phase={phase}", file=sys.stderr, flush=True)
            network.start(); database.start()
            redis.start(entrypoint="redis-server", command=["--save", "", "--appendonly", "no"])
            # Local socket administration is restricted to the owned database;
            # application TCP connections require the switched credentials.
            database.exec(["sh", "-c", "printf 'local all all trust\nhost all all 0.0.0.0/0 scram-sha-256\nhost all all ::/0 scram-sha-256\n' > /var/lib/postgresql/data/pg_hba.conf; pg_ctl reload -D /var/lib/postgresql/data"])
            database.sql(b"ALTER ROLE studio_drill PASSWORD 'synthetic-old';")
            phase = "baseline_migration"
            print(f"release_phase={phase}", file=sys.stderr, flush=True)
            migration(releases[0], baseline, network, database, redis, "synthetic-old", "head")
            phase = "baseline_roles"
            apply_roles(database, trees[0], password="synthetic-old")
            phase = "baseline_runtime"
            print(f"release_phase={phase}", file=sys.stderr, flush=True)
            containers, old_schema = start_release(releases[0], baseline, network, database, redis, "synthetic-old")
            phase = "baseline_metadata"
            containers[0].exec(["python", "-c", "from datetime import datetime,timedelta,timezone;from studio_api.db import SessionLocal;from studio_api.models import User,Project,Source,SourceType,SourceUploadStatus; db=SessionLocal();u=User(email='release-drill@example.test');db.add(u);db.flush();p=Project(owner_user_id=u.id,title='Synthetic release');db.add(p);db.flush();db.add(Source(project_id=p.id,source_type=SourceType.local_upload,original_filename='synthetic.wav',mime_type='audio/wav',size_bytes=42,upload_status=SourceUploadStatus.uploaded,expires_at=datetime.now(timezone.utc)+timedelta(days=1)));db.commit()"])
            snapshot_sql = b"SELECT u.email,s.original_filename,s.size_bytes,s.expires_at FROM sources s JOIN projects p ON p.id=s.project_id JOIN users u ON u.id=p.owner_user_id WHERE u.email='release-drill@example.test';"
            metadata = database.sql(snapshot_sql)
            for container in reversed(containers): container.close()
            containers = []
            phase = "candidate_migration"
            print(f"release_phase={phase}", file=sys.stderr, flush=True)
            migration(releases[1], candidate, network, database, redis, "synthetic-old", "head")
            phase = "candidate_roles"
            apply_roles(database, trees[1], password="synthetic-new")
            phase = "candidate_runtime"
            print(f"release_phase={phase}", file=sys.stderr, flush=True)
            containers, new_schema = start_release(releases[1], candidate, network, database, redis, "synthetic-new")
            if database.sql(snapshot_sql) != metadata:
                raise DrillFailure("release_upgrade_changed_source_metadata")
            assert_rejected_credential(containers[0], "synthetic-old")
            for container in reversed(containers): container.close()
            containers = []
            phase = "rollback_migration"
            print(f"release_phase={phase}", file=sys.stderr, flush=True)
            migration(releases[1], candidate, network, database, redis, "synthetic-old", old_schema)
            phase = "rollback_roles"
            apply_roles(database, trees[0], password="synthetic-old")
            phase = "rollback_runtime"
            print(f"release_phase={phase}", file=sys.stderr, flush=True)
            containers, restored_schema = start_release(releases[0], baseline, network, database, redis, "synthetic-old")
            if database.sql(snapshot_sql) != metadata:
                raise DrillFailure("release_rollback_changed_source_metadata")
            assert_rejected_credential(containers[0], "synthetic-new")
            if restored_schema != old_schema:
                raise DrillFailure("release_rollback_schema_mismatch")
            return {"result": "PASS", "baseline": baseline, "candidate": candidate,
                "baseline_schema": old_schema, "candidate_schema": new_schema, "restored_schema": restored_schema,
                "components": ["api", "web", "worker"], "config_switch": "synthetic_api_worker_credentials_restored",
                "source_metadata_preserved": True, "superseded_credentials_rejected": True,
                "artifacts": [{component: value[1] for component, value in images.items()} for images in releases],
                "seconds": round(time.monotonic() - started, 2), "environment": "isolated_synthetic_internal_network",
                "production_rollback_verified": False,
                "limits": "No production data, migrations or providers. Synthetic secret initialization substitutes production secret staging; bootstrap credentials never enter API/worker."}
    except DrillFailure as error:
        raise DrillFailure(f"{phase}:{error}") from None
    finally:
        for container in reversed(containers): container.close()
        redis.close(); database.close(); network.close()
        for tag in artifact_tags:
            inspect = subprocess.run(["docker", "image", "inspect", tag], capture_output=True, timeout=20)
            if inspect.returncode:
                continue
            record = json.loads(inspect.stdout)[0]
            if record["Config"].get("Labels", {}).get(LABEL) != nonce:
                raise DrillFailure("release_image_cleanup_boundary_invalid")
            _run(["docker", "image", "rm", tag], timeout=30)


def assert_rejected_credential(container, password):
    container.exec(["python", "-c",
        "import os,psycopg,sys;\ntry:\n c=psycopg.connect(host=os.environ['STUDIO_DATABASE_HOST'],dbname='studio_drill',user='studio_api',password=sys.argv[1],connect_timeout=3)\nexcept psycopg.errors.InvalidPassword:\n print('superseded_credential_rejected')\nelse:\n c.close();raise SystemExit(1)", password])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", required=True)
    parser.add_argument("--candidate", required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(rehearse(baseline=args.baseline, candidate=args.candidate)))
    except DrillFailure as error:
        print(json.dumps({"result": "FAIL", "reason": str(error)}))
        raise SystemExit(1)
