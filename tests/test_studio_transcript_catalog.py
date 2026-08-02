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


def catalog_evidence_row(
    *,
    source_identity_value: str,
    source_identity_kind: str = "studio_source",
    settings_status: str = "exact",
    provider: str | None = "elevenlabs",
    model: str | None = "scribe_v2",
    language_mode: str | None = "ru",
    diarization_enabled: bool | None = False,
    transcript_standard: str = "transcript_doc_v1.2",
):
    return (
        enum(source_identity_kind),
        source_identity_value,
        enum(settings_status),
        provider,
        model,
        language_mode,
        diarization_enabled,
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


def test_linked_catalog_metadata_extends_existing_result_authority_fail_closed():
    from studio_api.transcript_catalog import (
        ExistingResultMatchStatus,
        accepted_catalog_evidence_from_rows,
        classify_existing_results,
        current_effective_settings,
    )

    exact = source("private-exact-source")
    legacy = source("private-legacy-source")
    indeterminate = source("private-indeterminate-source")
    malformed = source("private-malformed-source")
    evidence = accepted_catalog_evidence_from_rows(
        [
            catalog_evidence_row(
                source_identity_value="private-exact-source",
                diarization_enabled=True,
            ),
            catalog_evidence_row(
                source_identity_value="private-legacy-source",
                diarization_enabled=True,
                transcript_standard="transcript_doc_v1.1",
            ),
            catalog_evidence_row(
                source_identity_value="private-indeterminate-source",
                settings_status="indeterminate",
                provider=None,
                model=None,
                language_mode=None,
                diarization_enabled=None,
            ),
            catalog_evidence_row(
                source_identity_value="private-malformed-source",
                provider=None,
                diarization_enabled=True,
            ),
            catalog_evidence_row(
                source_identity_value="ignored-private-source",
                source_identity_kind="unsupported",
                diarization_enabled=True,
            ),
        ]
    )

    matches = classify_existing_results(
        sources=(exact, legacy, indeterminate, malformed),
        evidence=evidence,
        target_settings=current_effective_settings(
            language_mode="ru",
            diarization_enabled=True,
        ),
    )

    assert matches["private-exact-source"].status == (
        ExistingResultMatchStatus.accepted_match
    )
    assert matches["private-legacy-source"].status == (
        ExistingResultMatchStatus.standardization_required
    )
    assert matches["private-indeterminate-source"].status == (
        ExistingResultMatchStatus.indeterminate
    )
    assert matches["private-malformed-source"].status == (
        ExistingResultMatchStatus.indeterminate
    )
    assert all(match.accepted_output_count == 1 for match in matches.values())
    assert "private-exact-source" not in repr(evidence)
    assert "ignored-private-source" not in repr(evidence)


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


def test_provider_attempt_authority_is_per_source_safe_and_fail_closed():
    from studio_api.transcript_catalog import (
        ProviderAttemptAuthorityStatus,
        ProviderAttemptEvidence,
        catalog_source_identity,
        classify_provider_attempt_authorities,
        current_effective_settings,
    )

    target = current_effective_settings(
        language_mode="ru",
        diarization_enabled=False,
    )
    different = current_effective_settings(
        language_mode="detect",
        diarization_enabled=False,
    )
    available = source("available")
    in_flight = source("in-flight")
    unresolved = source(
        "new-drive-row",
        source_type="google_drive",
        drive_file_id="private-drive-file",
    )
    evidence = (
        ProviderAttemptEvidence(
            source_identity=catalog_source_identity(in_flight),
            settings=target,
            job_status="processing",
            retry_disposition="retry_safe",
        ),
        ProviderAttemptEvidence(
            source_identity=catalog_source_identity(
                source(
                    "old-drive-row",
                    source_type="google_drive",
                    drive_file_id="private-drive-file",
                )
            ),
            settings=None,
            job_status="failed",
            retry_disposition="provider_outcome_uncertain",
        ),
        ProviderAttemptEvidence(
            source_identity=catalog_source_identity(available),
            settings=different,
            job_status="processing",
            retry_disposition="undetermined",
        ),
        ProviderAttemptEvidence(
            source_identity=catalog_source_identity(available),
            settings=target,
            job_status="failed",
            retry_disposition="retry_safe",
        ),
    )

    authorities = classify_provider_attempt_authorities(
        sources=(available, in_flight, unresolved),
        evidence=evidence,
        target_settings=target,
    )

    assert authorities == {
        "available": ProviderAttemptAuthorityStatus.available,
        "in-flight": ProviderAttemptAuthorityStatus.in_flight,
        "new-drive-row": ProviderAttemptAuthorityStatus.unresolved,
    }
    encoded = json.dumps(
        {source_id: authority.value for source_id, authority in authorities.items()}
    )
    assert "private-drive-file" not in encoded
    assert "old-drive-row" not in encoded


def test_provider_attempt_authority_prioritizes_in_flight_over_unresolved():
    from studio_api.transcript_catalog import (
        ProviderAttemptAuthorityStatus,
        ProviderAttemptEvidence,
        catalog_source_identity,
        classify_provider_attempt_authorities,
        current_effective_settings,
    )

    candidate = source("candidate")
    target = current_effective_settings(
        language_mode="ru",
        diarization_enabled=True,
    )
    authority = classify_provider_attempt_authorities(
        sources=(candidate,),
        evidence=(
            ProviderAttemptEvidence(
                source_identity=catalog_source_identity(candidate),
                settings=target,
                job_status="failed",
                retry_disposition="provider_result_lost",
            ),
            ProviderAttemptEvidence(
                source_identity=catalog_source_identity(candidate),
                settings=target,
                job_status="processing",
                retry_disposition="undetermined",
            ),
        ),
        target_settings=target,
    )

    assert authority["candidate"] == ProviderAttemptAuthorityStatus.in_flight


def test_media_clip_range_participates_in_existing_result_identity():
    from studio_api.transcript_catalog import (
        ExistingResultMatchStatus,
        accepted_evidence_from_rows,
        classify_existing_results,
        current_effective_settings,
    )

    candidate = source(
        "source-clip",
        source_type="google_drive",
        drive_file_id="drive-clip",
    )
    base_row = evidence_row(
        source_id=candidate.id,
        source_type="google_drive",
        drive_file_id=candidate.drive_file_id,
        options_json='{"diarize":false}',
    )
    evidence = accepted_evidence_from_rows(
        [(*base_row[:7], 0, 610, *base_row[7:])]
    )
    first = current_effective_settings(
        language_mode="ru",
        diarization_enabled=False,
        media_clip_start_seconds=0,
        media_clip_end_seconds=610,
    )
    second = current_effective_settings(
        language_mode="ru",
        diarization_enabled=False,
        media_clip_start_seconds=610,
        media_clip_end_seconds=None,
    )

    assert classify_existing_results(
        sources=(candidate,), evidence=evidence, target_settings=first
    )[candidate.id].status == ExistingResultMatchStatus.accepted_match
    assert classify_existing_results(
        sources=(candidate,), evidence=evidence, target_settings=second
    )[candidate.id].status == ExistingResultMatchStatus.no_match


def test_media_clip_range_participates_in_provider_attempt_identity():
    from studio_api.transcript_catalog import (
        ProviderAttemptAuthorityStatus,
        ProviderAttemptEvidence,
        catalog_source_identity,
        classify_provider_attempt_authorities,
        current_effective_settings,
    )

    candidate = source("source-clip-provider")
    first = current_effective_settings(
        language_mode="ru",
        diarization_enabled=False,
        media_clip_start_seconds=0,
        media_clip_end_seconds=610,
    )
    second = current_effective_settings(
        language_mode="ru",
        diarization_enabled=False,
        media_clip_start_seconds=610,
        media_clip_end_seconds=None,
    )
    evidence = (
        ProviderAttemptEvidence(
            source_identity=catalog_source_identity(candidate),
            settings=first,
            job_status="processing",
            retry_disposition="undetermined",
        ),
    )

    assert classify_provider_attempt_authorities(
        sources=(candidate,), evidence=evidence, target_settings=first
    )[candidate.id] == ProviderAttemptAuthorityStatus.in_flight
    assert classify_provider_attempt_authorities(
        sources=(candidate,), evidence=evidence, target_settings=second
    )[candidate.id] == ProviderAttemptAuthorityStatus.available
