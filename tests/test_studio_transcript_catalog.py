from __future__ import annotations

import json
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))


def enum(value: str):
    return SimpleNamespace(value=value)


def source(
    source_id: str,
    *,
    source_type: str = "local_upload",
    drive_file_id: str | None = None,
):
    return SimpleNamespace(
        id=source_id,
        source_type=enum(source_type),
        drive_file_id=drive_file_id,
        original_filename="private recording.mp4",
        s3_object_key="private/object/key",
    )


def evidence_row(
    *,
    source_id: str,
    source_type: str,
    drive_file_id: str | None = None,
    language: str | None = "ru",
    options_json: str | None = None,
    transcript_standard: str = "transcript_doc_v1.2",
    job_provider=None,
    credential_provider="elevenlabs",
    output_kind="google_docs_transcript",
):
    return (
        source_id,
        enum(source_type),
        drive_file_id,
        job_provider,
        enum(credential_provider) if credential_provider else None,
        language,
        options_json,
        output_kind,
        transcript_standard,
    )


def test_catalog_uses_owner_internal_stable_source_identity_without_exposing_it():
    from studio_api.transcript_catalog import (
        CatalogSourceIdentityKind,
        catalog_source_identity,
    )

    google_a = source(
        "studio-source-a",
        source_type="google_drive",
        drive_file_id="private-drive-file",
    )
    google_b = source(
        "studio-source-b",
        source_type="google_drive",
        drive_file_id="private-drive-file",
    )
    local = source("private-local-source")

    assert catalog_source_identity(google_a) == catalog_source_identity(google_b)
    assert catalog_source_identity(google_a).kind == (
        CatalogSourceIdentityKind.google_drive_file
    )
    assert catalog_source_identity(local).kind == CatalogSourceIdentityKind.studio_source
    assert "private-drive-file" not in repr(catalog_source_identity(google_a))
    assert "private-local-source" not in repr(catalog_source_identity(local))


def test_catalog_classifies_exact_standardization_unknown_and_different_settings():
    from studio_api.transcript_catalog import (
        ExistingResultMatchStatus,
        accepted_evidence_from_rows,
        classify_existing_results,
        current_effective_settings,
    )

    exact = source("exact")
    legacy = source("legacy")
    unknown = source("unknown")
    different = source("different")
    target = current_effective_settings(language_mode="ru", diarization_enabled=True)
    evidence = accepted_evidence_from_rows(
        [
            evidence_row(
                source_id="exact",
                source_type="local_upload",
                options_json='{"diarize":true}',
            ),
            evidence_row(
                source_id="exact",
                source_type="local_upload",
                options_json='{"diarize":true}',
                credential_provider=None,
            ),
            evidence_row(
                source_id="legacy",
                source_type="local_upload",
                options_json='{"diarize":true}',
                transcript_standard="transcript_doc_v1.1",
            ),
            evidence_row(
                source_id="unknown",
                source_type="local_upload",
                options_json='{"diarize":true}',
                credential_provider=None,
            ),
            evidence_row(
                source_id="different",
                source_type="local_upload",
                language="detect",
                options_json='{"diarize":true}',
            ),
            evidence_row(
                source_id="exact",
                source_type="local_upload",
                options_json='{"diarize":true}',
                output_kind="not-an-accepted-transcript",
            ),
        ]
    )

    matches = classify_existing_results(
        sources=[exact, legacy, unknown, different],
        evidence=evidence,
        target_settings=target,
    )

    assert matches["exact"].status == ExistingResultMatchStatus.accepted_match
    assert matches["exact"].accepted_output_count == 2
    assert matches["exact"].matching_settings_count == 1
    assert (
        matches["legacy"].status
        == ExistingResultMatchStatus.standardization_required
    )
    assert matches["unknown"].status == ExistingResultMatchStatus.indeterminate
    assert matches["different"].status == ExistingResultMatchStatus.no_match
    assert matches["different"].accepted_output_count == 1
    assert matches["different"].matching_settings_count == 0


def test_catalog_matches_reselected_google_file_across_studio_source_rows():
    from studio_api.transcript_catalog import (
        ExistingResultMatchStatus,
        accepted_evidence_from_rows,
        classify_existing_results,
        current_effective_settings,
    )

    candidate = source(
        "new-studio-source",
        source_type="google_drive",
        drive_file_id="same-private-drive-file",
    )
    evidence = accepted_evidence_from_rows(
        [
            evidence_row(
                source_id="old-studio-source",
                source_type="google_drive",
                drive_file_id="same-private-drive-file",
            )
        ]
    )

    match = classify_existing_results(
        sources=[candidate],
        evidence=evidence,
        target_settings=current_effective_settings(
            language_mode="ru",
            diarization_enabled=False,
        ),
    )["new-studio-source"]

    assert match.status == ExistingResultMatchStatus.accepted_match
    encoded = json.dumps(
        {
            "status": match.status.value,
            "accepted_output_count": match.accepted_output_count,
            "matching_settings_count": match.matching_settings_count,
        }
    )
    assert "same-private-drive-file" not in encoded
    assert "old-studio-source" not in encoded


def test_catalog_settings_contract_is_strict_and_deterministic():
    from studio_api.transcript_catalog import (
        CURRENT_TRANSCRIPTION_MODEL,
        CURRENT_TRANSCRIPTION_PROVIDER,
        current_effective_settings,
        effective_settings_from_persisted_job,
        elevenlabs_effective_settings,
    )

    target = current_effective_settings(
        language_mode="detect",
        diarization_enabled=True,
    )
    restored = effective_settings_from_persisted_job(
        job_provider=None,
        credential_provider=enum("elevenlabs"),
        language=None,
        options_json='{"diarize":true}',
    )

    assert restored == target
    assert target.provider == CURRENT_TRANSCRIPTION_PROVIDER == "elevenlabs"
    assert target.model == CURRENT_TRANSCRIPTION_MODEL == "scribe_v2"
    assert effective_settings_from_persisted_job(
        job_provider=None,
        credential_provider=enum("elevenlabs"),
        language="EN_us",
        options_json=None,
    ) == elevenlabs_effective_settings(
        language_mode="en_us",
        diarization_enabled=False,
    )
    assert (
        effective_settings_from_persisted_job(
            job_provider="openai",
            credential_provider=enum("elevenlabs"),
            language="detect",
            options_json='{"diarize":true}',
        )
        is None
    )
    with pytest.raises(ValueError, match="language mode"):
        current_effective_settings(
            language_mode="fr",
            diarization_enabled=False,
        )
    with pytest.raises(ValueError, match="language mode"):
        current_effective_settings(
            language_mode="",
            diarization_enabled=False,
        )
    with pytest.raises(ValueError, match="boolean"):
        current_effective_settings(
            language_mode="ru",
            diarization_enabled="false",
        )
    with pytest.raises(ValueError, match="language mode"):
        elevenlabs_effective_settings(
            language_mode="not valid",
            diarization_enabled=False,
        )
