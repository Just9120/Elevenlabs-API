import base64
import os
import sys
from pathlib import Path

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))


@pytest.fixture
def studio_model_modules(monkeypatch, tmp_path):
    password_file = tmp_path / "studio_test_pg_password"
    master_key_file = tmp_path / "studio_test_master_key"
    password_file.write_text(os.environ.get("STUDIO_TEST_POSTGRES_PASSWORD", "studio_test_password"), encoding="utf-8")
    master_key_file.write_text(base64.b64encode(b"1" * 32).decode(), encoding="utf-8")
    monkeypatch.setenv("STUDIO_DATABASE_SCHEME", "postgresql+psycopg")
    monkeypatch.setenv("STUDIO_DATABASE_HOST", "127.0.0.1")
    monkeypatch.setenv("STUDIO_DATABASE_PORT", "5432")
    monkeypatch.setenv("STUDIO_DATABASE_NAME", "studio_test")
    monkeypatch.setenv("STUDIO_DATABASE_USER", "studio_test")
    monkeypatch.setenv("STUDIO_POSTGRES_PASSWORD_FILE", str(password_file))
    monkeypatch.setenv("STUDIO_CREDENTIAL_MASTER_KEY_FILE", str(master_key_file))
    from studio_api.job_retry_recovery import MAX_PROCESSING_ATTEMPTS, SAFE_PROVIDER_FAILURES, UNCERTAIN_PROVIDER_FAILURES
    from studio_api.models import SourceAttemptRetryDisposition, SourceAttemptStage, TranscriptionJobSourceAttempt
    return {
        "MAX_PROCESSING_ATTEMPTS": MAX_PROCESSING_ATTEMPTS,
        "SAFE_PROVIDER_FAILURES": SAFE_PROVIDER_FAILURES,
        "UNCERTAIN_PROVIDER_FAILURES": UNCERTAIN_PROVIDER_FAILURES,
        "SourceAttemptRetryDisposition": SourceAttemptRetryDisposition,
        "SourceAttemptStage": SourceAttemptStage,
        "TranscriptionJobSourceAttempt": TranscriptionJobSourceAttempt,
    }


def test_retry_recovery_model_metadata_contract(studio_model_modules):
    table = studio_model_modules["TranscriptionJobSourceAttempt"].__table__
    assert table.name == "transcription_job_source_attempts"
    assert studio_model_modules["MAX_PROCESSING_ATTEMPTS"] == 3
    assert {e.value for e in studio_model_modules["SourceAttemptStage"]} == {
        "prepared", "provider_request_started", "provider_response_returned", "google_handoff", "output_persisted", "failed"
    }
    assert {e.value for e in studio_model_modules["SourceAttemptRetryDisposition"]} == {
        "undetermined", "retry_safe", "provider_outcome_uncertain", "provider_result_lost", "output_reconciliation_required", "non_retryable", "completed"
    }
    assert {"provider_authentication_rejected", "provider_request_rejected", "provider_rate_limited"} <= studio_model_modules["SAFE_PROVIDER_FAILURES"]
    assert {"provider_timeout", "provider_unavailable", "malformed_provider_response", "unknown"} <= studio_model_modules["UNCERTAIN_PROVIDER_FAILURES"]
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
