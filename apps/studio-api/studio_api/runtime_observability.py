from __future__ import annotations

import hashlib
import json
import logging
import re
import socket
import threading
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable
from urllib.request import urlopen

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import text

WEB_BUILD_METADATA_URL = "http://studio-web:8080/build-meta.json"
COMMIT_RE = re.compile(r"^[0-9a-f]{40}$")
SAFE_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$")
KNOWN_COMPONENTS = frozenset({"web", "api", "worker"})


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def current_worker_runtime_instance_id(
    *,
    pid1_stat_path: Path = Path("/proc/1/stat"),
    hostname: str | None = None,
) -> str:
    """Derive one opaque ID for the current container process incarnation."""
    raw = pid1_stat_path.read_text(encoding="utf-8")
    closing_paren = raw.rfind(")")
    fields_after_command = raw[closing_paren + 1 :].split() if closing_paren > 0 else []
    # /proc/<pid>/stat field 22 is process start time; the first token above is field 3.
    if len(fields_after_command) <= 19 or not fields_after_command[19].isdigit():
        raise RuntimeError("worker_runtime_instance_unavailable")
    host = hostname if hostname is not None else socket.gethostname()
    if not isinstance(host, str) or not host or len(host) > 255:
        raise RuntimeError("worker_runtime_instance_unavailable")
    digest = hashlib.sha256(f"{host}\n{fields_after_command[19]}".encode("utf-8")).hexdigest()
    return f"worker-{digest}"


def _aware(value: datetime | str) -> datetime:
    if isinstance(value, str):
        value = datetime.fromisoformat(value)
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


@dataclass(frozen=True)
class RuntimeIdentity:
    component: str
    release_version: str
    build_id: str
    commit_sha: str

    def payload(self) -> dict[str, str]:
        return {
            "component": self.component,
            "release_version": self.release_version,
            "build_id": self.build_id,
            "commit_sha": self.commit_sha,
        }


def parse_runtime_identity(candidate: object, *, expected_component: str) -> RuntimeIdentity | None:
    if expected_component not in KNOWN_COMPONENTS or not isinstance(candidate, dict):
        return None
    component = candidate.get("component")
    release_version = candidate.get("release_version")
    build_id = candidate.get("build_id")
    commit_sha = candidate.get("commit_sha")
    if component != expected_component:
        return None
    if not isinstance(release_version, str) or not SAFE_ID_RE.fullmatch(release_version):
        return None
    if release_version.lower() == "unknown":
        return None
    if not isinstance(build_id, str) or not SAFE_ID_RE.fullmatch(build_id):
        return None
    if build_id.lower() == "unknown":
        return None
    if not isinstance(commit_sha, str) or not COMMIT_RE.fullmatch(commit_sha):
        return None
    return RuntimeIdentity(component, release_version, build_id, commit_sha)


def settings_runtime_identity(settings, *, expected_component: str) -> RuntimeIdentity | None:
    return parse_runtime_identity(
        {
            "component": settings.runtime_component,
            "release_version": settings.runtime_release_version,
            "build_id": settings.runtime_build_id,
            "commit_sha": settings.runtime_commit_sha,
        },
        expected_component=expected_component,
    )


def runtime_identity_payload(identity: RuntimeIdentity | None) -> dict[str, object]:
    if identity is None:
        return {"status": "unavailable"}
    return {"status": "available", **identity.payload()}


def coherent_release_version(component_status: dict[str, dict[str, object]]) -> str:
    if set(component_status) != KNOWN_COMPONENTS:
        return "unavailable"
    releases: set[object] = set()
    for payload in component_status.values():
        if payload.get("status") not in {"available", "ready"}:
            return "unavailable"
        release = payload.get("release_version")
        if not isinstance(release, str) or not SAFE_ID_RE.fullmatch(release) or release.lower() == "unknown":
            return "unavailable"
        releases.add(release)
    return next(iter(releases)) if len(releases) == 1 else "unavailable"


def load_web_runtime_identity(
    *,
    opener: Callable = urlopen,
    url: str = WEB_BUILD_METADATA_URL,
) -> RuntimeIdentity | None:
    try:
        with opener(url, timeout=2) as response:
            raw = response.read(4097)
        if len(raw) > 4096:
            return None
        candidate = json.loads(raw.decode("utf-8"))
    except Exception:
        return None
    return parse_runtime_identity(candidate, expected_component="web")


def repository_schema_head() -> str:
    config_path = "alembic.ini" if Path("alembic.ini").exists() else "apps/studio-api/alembic.ini"
    head = ScriptDirectory.from_config(Config(config_path)).get_current_head()
    if not isinstance(head, str) or not SAFE_ID_RE.fullmatch(head):
        raise RuntimeError("schema_head_unavailable")
    return head


def database_schema_revision(db) -> str:
    rows = list(db.execute(text("select version_num from alembic_version")).scalars())
    if len(rows) != 1 or not isinstance(rows[0], str) or not SAFE_ID_RE.fullmatch(rows[0]):
        raise RuntimeError("schema_revision_unavailable")
    return rows[0]


def check_database_readiness(db) -> dict[str, str]:
    db.execute(text("select 1"))
    current = database_schema_revision(db)
    expected = repository_schema_head()
    if current != expected:
        raise RuntimeError("schema_revision_mismatch")
    return {"database": "reachable", "migrations": "current", "schema_revision": current}


def record_worker_runtime_heartbeat(
    db,
    *,
    identity: RuntimeIdentity,
    instance_id: str,
    started_at: datetime,
    seen_at: datetime | None = None,
) -> None:
    from .models import RuntimeComponentStatus

    if identity.component != "worker" or not SAFE_ID_RE.fullmatch(instance_id):
        raise RuntimeError("worker_runtime_identity_invalid")
    seen_at = seen_at or utcnow()
    row = db.get(RuntimeComponentStatus, "worker")
    if row is None:
        row = RuntimeComponentStatus(
            component="worker",
            instance_id=instance_id,
            release_version=identity.release_version,
            build_id=identity.build_id,
            commit_sha=identity.commit_sha,
            started_at=started_at,
            last_seen_at=seen_at,
        )
        db.add(row)
    else:
        if row.instance_id != instance_id:
            row.started_at = started_at
        row.instance_id = instance_id
        row.release_version = identity.release_version
        row.build_id = identity.build_id
        row.commit_sha = identity.commit_sha
        row.last_seen_at = seen_at
    db.commit()


def load_worker_runtime_status(
    db,
    *,
    now: datetime | None = None,
    stale_after_seconds: int,
    expected_instance_id: str | None = None,
) -> dict[str, object]:
    row = db.execute(text(
        "select component, instance_id, release_version, build_id, commit_sha, started_at, last_seen_at "
        "from runtime_component_status where component = 'worker'"
    )).mappings().first()
    if row is None:
        return {"status": "absent"}
    identity = parse_runtime_identity(
        {
            "component": row["component"],
            "release_version": row["release_version"],
            "build_id": row["build_id"],
            "commit_sha": row["commit_sha"],
        },
        expected_component="worker",
    )
    if identity is None:
        return {"status": "invalid"}
    if expected_instance_id is not None and row["instance_id"] != expected_instance_id:
        return {"status": "foreign"}
    now = now or utcnow()
    last_seen = _aware(row["last_seen_at"])
    age_seconds = max(0, int((now - last_seen).total_seconds()))
    status = "ready" if age_seconds <= stale_after_seconds else "stale"
    return {
        "status": status,
        **identity.payload(),
        "started_at": _aware(row["started_at"]).isoformat(),
        "last_seen_at": last_seen.isoformat(),
        "heartbeat_age_seconds": age_seconds,
    }


def queue_runtime_status(db, *, now: datetime | None = None) -> dict[str, object]:
    from .models import AudioPreparationJob, AudioPreparationStatus, JobStatus, TranscriptionJob

    now = now or utcnow()
    transcription_queued = db.query(TranscriptionJob).filter(TranscriptionJob.status == JobStatus.queued).count()
    transcription_processing = db.query(TranscriptionJob).filter(TranscriptionJob.status == JobStatus.processing).count()
    audio_queued = db.query(AudioPreparationJob).filter(
        AudioPreparationJob.status.in_((AudioPreparationStatus.preview_queued, AudioPreparationStatus.queued))
    ).count()
    audio_processing = db.query(AudioPreparationJob).filter(
        AudioPreparationJob.status.in_((AudioPreparationStatus.analyzing, AudioPreparationStatus.processing))
    ).count()
    oldest_candidates = [
        db.query(TranscriptionJob.created_at)
        .filter(TranscriptionJob.status == JobStatus.queued)
        .order_by(TranscriptionJob.created_at.asc())
        .limit(1)
        .scalar(),
        db.query(AudioPreparationJob.created_at)
        .filter(AudioPreparationJob.status.in_((AudioPreparationStatus.preview_queued, AudioPreparationStatus.queued)))
        .order_by(AudioPreparationJob.created_at.asc())
        .limit(1)
        .scalar(),
    ]
    oldest = min((_aware(value) for value in oldest_candidates if value is not None), default=None)
    return {
        "status": "ready",
        "queued": transcription_queued + audio_queued,
        "processing": transcription_processing + audio_processing,
        "oldest_queued_age_seconds": max(0, int((now - oldest).total_seconds())) if oldest else 0,
    }


def stt_provider_runtime_status(db, *, owner_user_id: str) -> dict[str, object]:
    from .models import CredentialStatus, ProviderCredential, ProviderCredentialVersion

    rows = db.query(ProviderCredential).filter(
        ProviderCredential.user_id == owner_user_id,
        ProviderCredential.status == CredentialStatus.active,
        ProviderCredential.deleted_at.is_(None),
    ).all()
    providers: set[str] = set()
    valid_count = 0
    for credential in rows:
        providers.add(credential.provider.value)
        version = db.get(ProviderCredentialVersion, credential.active_version_id) if credential.active_version_id else None
        if (
            version is not None
            and version.deleted_at is None
            and version.revoked_at is None
            and bool(version.ciphertext)
            and bool(version.nonce)
        ):
            valid_count += 1
    if not rows:
        status = "unconfigured"
    elif valid_count == len(rows):
        status = "configured"
    else:
        status = "degraded"
    return {
        "status": status,
        "configured_credentials": valid_count,
        "providers": sorted(providers),
        "availability": "unknown",
        "probe": "not_run",
    }


def source_storage_runtime_status(settings, *, client_factory: Callable | None = None) -> dict[str, str]:
    if not settings.source_storage_configured():
        return {"status": "unconfigured", "probe": "not_run"}
    try:
        if client_factory is None:
            import boto3
            from botocore.config import Config as BotoConfig

            client = boto3.client(
                "s3",
                endpoint_url=settings.source_s3_endpoint_url,
                region_name=settings.source_s3_region,
                aws_access_key_id=Path(settings.source_s3_access_key_id_file).read_text(encoding="utf-8").strip(),
                aws_secret_access_key=Path(settings.source_s3_secret_access_key_file).read_text(encoding="utf-8").strip(),
                config=BotoConfig(
                    connect_timeout=2,
                    read_timeout=2,
                    retries={"max_attempts": 1, "mode": "standard"},
                ),
            )
        else:
            client = client_factory()
        client.head_bucket(Bucket=settings.source_s3_bucket)
    except Exception:
        return {"status": "unavailable", "probe": "read_only_head"}
    return {"status": "ready", "probe": "read_only_head"}


class WorkerRuntimeHeartbeat:
    def __init__(
        self,
        *,
        session_factory: Callable,
        identity: RuntimeIdentity,
        instance_id: str,
        interval_seconds: int,
        logger: logging.Logger,
        clock: Callable[[], datetime] = utcnow,
    ):
        self.session_factory = session_factory
        self.identity = identity
        self.instance_id = instance_id
        self.interval_seconds = interval_seconds
        self.logger = logger
        self.clock = clock
        self.started_at = clock()
        self.stop_event = threading.Event()
        self.thread: threading.Thread | None = None

    def start(self) -> None:
        if self.thread is not None:
            raise RuntimeError("runtime_heartbeat_already_started")
        self.thread = threading.Thread(target=self._run, name="studio-worker-runtime-heartbeat", daemon=True)
        self.thread.start()

    def stop_and_join(self, timeout_seconds: float = 5) -> None:
        self.stop_event.set()
        if self.thread is not None:
            self.thread.join(timeout_seconds)

    def _run(self) -> None:
        while not self.stop_event.is_set():
            db = self.session_factory()
            try:
                record_worker_runtime_heartbeat(
                    db,
                    identity=self.identity,
                    instance_id=self.instance_id,
                    started_at=self.started_at,
                    seen_at=self.clock(),
                )
            except Exception:
                try:
                    db.rollback()
                except Exception:
                    pass
                self.logger.warning("studio_worker_runtime_heartbeat_failed")
            finally:
                try:
                    db.close()
                except Exception:
                    pass
            self.stop_event.wait(self.interval_seconds)
