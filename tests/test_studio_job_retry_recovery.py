import base64, os, sys, tempfile
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))
os.environ.setdefault("STUDIO_DATABASE_SCHEME", "postgresql+psycopg")
os.environ.setdefault("STUDIO_DATABASE_HOST", "127.0.0.1")
os.environ.setdefault("STUDIO_DATABASE_PORT", "5432")
os.environ.setdefault("STUDIO_DATABASE_NAME", "studio_test")
os.environ.setdefault("STUDIO_DATABASE_USER", "studio_test")
os.environ.setdefault("STUDIO_POSTGRES_PASSWORD_FILE", str(Path(tempfile.gettempdir()) / "studio_test_pg_password"))
os.environ.setdefault("STUDIO_CREDENTIAL_MASTER_KEY_FILE", str(Path(tempfile.gettempdir()) / "studio_test_master_key"))
Path(os.environ["STUDIO_POSTGRES_PASSWORD_FILE"]).write_text(os.environ.get("STUDIO_TEST_POSTGRES_PASSWORD", "studio_test_password"), encoding="utf-8")
Path(os.environ["STUDIO_CREDENTIAL_MASTER_KEY_FILE"]).write_text(base64.b64encode(b"1" * 32).decode(), encoding="utf-8")
from alembic.config import Config
from alembic.script import ScriptDirectory

from studio_api.job_retry_recovery import MAX_PROCESSING_ATTEMPTS, SAFE_PROVIDER_FAILURES, UNCERTAIN_PROVIDER_FAILURES
from studio_api.models import Base, SourceAttemptRetryDisposition, SourceAttemptStage, TranscriptionJobSourceAttempt


def test_retry_recovery_model_metadata_contract():
    table = TranscriptionJobSourceAttempt.__table__
    assert table.name == "transcription_job_source_attempts"
    assert MAX_PROCESSING_ATTEMPTS == 3
    assert {e.value for e in SourceAttemptStage} == {
        "prepared", "provider_request_started", "provider_response_returned", "google_handoff", "output_persisted", "failed"
    }
    assert {e.value for e in SourceAttemptRetryDisposition} == {
        "undetermined", "retry_safe", "provider_outcome_uncertain", "provider_result_lost", "output_reconciliation_required", "non_retryable", "completed"
    }
    assert {"provider_authentication_rejected", "provider_request_rejected", "provider_rate_limited"} <= SAFE_PROVIDER_FAILURES
    assert {"provider_timeout", "provider_unavailable", "malformed_provider_response", "unknown"} <= UNCERTAIN_PROVIDER_FAILURES
    assert {"owner_user_id", "project_id", "job_id", "job_source_id", "attempt_number", "stage", "retry_disposition"} <= set(table.c.keys())
    assert {tuple(c.name for c in constraint.columns) for constraint in table.constraints if getattr(constraint, "columns", None)} >= {("job_source_id", "attempt_number")}
    indexes = {idx.name: tuple(col.name for col in idx.columns) for idx in table.indexes}
    assert indexes["ix_source_attempts_job_id"] == ("job_id",)
    assert indexes["ix_source_attempts_job_source_id"] == ("job_source_id",)
    assert indexes["ix_source_attempts_retry_disposition"] == ("retry_disposition",)
    assert indexes["ix_source_attempts_job_retry_disposition"] == ("job_id", "retry_disposition")


def test_alembic_single_head_is_retry_recovery():
    cfg = Config("apps/studio-api/alembic.ini")
    script = ScriptDirectory.from_config(cfg)
    assert script.get_heads() == ["0013_job_retry_recovery"]
    assert script.get_current_head() == "0013_job_retry_recovery"
