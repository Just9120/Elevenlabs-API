from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Iterable, Sequence

from .transcription_options import browser_language_mode, job_diarization_enabled


CURRENT_TRANSCRIPTION_PROVIDER = "elevenlabs"
CURRENT_TRANSCRIPTION_MODEL = "scribe_v2"
CURRENT_TRANSCRIPT_STANDARD = "transcript_doc_v1.2"
GOOGLE_DOCS_TRANSCRIPT_OUTPUT_KIND = "google_docs_transcript"


class CatalogSourceIdentityKind(str, Enum):
    google_drive_file = "google_drive_file"
    studio_source = "studio_source"


class ExistingResultMatchStatus(str, Enum):
    accepted_match = "accepted_match"
    standardization_required = "standardization_required"
    indeterminate = "indeterminate"
    no_match = "no_match"


@dataclass(frozen=True)
class CatalogSourceIdentity:
    kind: CatalogSourceIdentityKind
    value: str = field(repr=False)


@dataclass(frozen=True)
class EffectiveTranscriptionSettings:
    provider: str
    model: str
    language_mode: str
    diarization_enabled: bool


@dataclass(frozen=True)
class AcceptedTranscriptEvidence:
    source_identity: CatalogSourceIdentity
    settings: EffectiveTranscriptionSettings | None
    transcript_standard: str


@dataclass(frozen=True)
class ExistingResultMatch:
    status: ExistingResultMatchStatus
    accepted_output_count: int
    matching_settings_count: int


def current_effective_settings(
    *,
    language_mode: str,
    diarization_enabled: bool,
) -> EffectiveTranscriptionSettings:
    normalized_language = (
        language_mode.strip().lower() if isinstance(language_mode, str) else ""
    )
    if normalized_language not in {"ru", "detect"}:
        raise ValueError("Unsupported PWA transcription language mode")
    if not isinstance(diarization_enabled, bool):
        raise ValueError("Diarization selection must be boolean")
    return elevenlabs_effective_settings(
        language_mode=normalized_language,
        diarization_enabled=diarization_enabled,
    )


def elevenlabs_effective_settings(
    *,
    language_mode: str,
    diarization_enabled: bool,
) -> EffectiveTranscriptionSettings:
    normalized_language = _catalog_language_mode(language_mode)
    if normalized_language is None:
        raise ValueError("Unsupported transcription language mode")
    if not isinstance(diarization_enabled, bool):
        raise ValueError("Diarization selection must be boolean")
    return EffectiveTranscriptionSettings(
        provider=CURRENT_TRANSCRIPTION_PROVIDER,
        model=CURRENT_TRANSCRIPTION_MODEL,
        language_mode=normalized_language,
        diarization_enabled=bool(diarization_enabled),
    )


def catalog_source_identity(source: Any) -> CatalogSourceIdentity | None:
    source_id = _clean_private_identity(getattr(source, "id", None))
    source_type = _enum_value(getattr(source, "source_type", None))
    drive_file_id = _clean_private_identity(getattr(source, "drive_file_id", None))
    if source_type == "google_drive" and drive_file_id:
        return CatalogSourceIdentity(
            kind=CatalogSourceIdentityKind.google_drive_file,
            value=drive_file_id,
        )
    if source_id:
        return CatalogSourceIdentity(
            kind=CatalogSourceIdentityKind.studio_source,
            value=source_id,
        )
    return None


def effective_settings_from_persisted_job(
    *,
    job_provider: Any,
    credential_provider: Any,
    language: str | None,
    options_json: str | None,
) -> EffectiveTranscriptionSettings | None:
    explicit_provider = _enum_value(job_provider).strip().lower()
    selected_provider = explicit_provider or _enum_value(credential_provider).strip().lower()
    language_mode = _catalog_language_mode(browser_language_mode(language))
    if (
        selected_provider != CURRENT_TRANSCRIPTION_PROVIDER
        or language_mode is None
    ):
        return None
    return EffectiveTranscriptionSettings(
        provider=CURRENT_TRANSCRIPTION_PROVIDER,
        model=CURRENT_TRANSCRIPTION_MODEL,
        language_mode=language_mode,
        diarization_enabled=job_diarization_enabled(options_json),
    )


def accepted_evidence_from_rows(
    rows: Iterable[Sequence[Any]],
) -> tuple[AcceptedTranscriptEvidence, ...]:
    evidence: list[AcceptedTranscriptEvidence] = []
    for (
        source_id,
        source_type,
        drive_file_id,
        job_provider,
        credential_provider,
        language,
        options_json,
        output_kind,
        transcript_standard,
    ) in rows:
        if output_kind != GOOGLE_DOCS_TRANSCRIPT_OUTPUT_KIND:
            continue
        identity = catalog_source_identity(
            _SourceIdentityProjection(source_id, source_type, drive_file_id)
        )
        if identity is None:
            continue
        evidence.append(
            AcceptedTranscriptEvidence(
                source_identity=identity,
                settings=effective_settings_from_persisted_job(
                    job_provider=job_provider,
                    credential_provider=credential_provider,
                    language=language,
                    options_json=options_json,
                ),
                transcript_standard=str(transcript_standard or ""),
            )
        )
    return tuple(evidence)


def classify_existing_results(
    *,
    sources: Iterable[Any],
    evidence: Iterable[AcceptedTranscriptEvidence],
    target_settings: EffectiveTranscriptionSettings,
) -> dict[str, ExistingResultMatch]:
    evidence_rows = tuple(evidence)
    matches: dict[str, ExistingResultMatch] = {}
    for source in sources:
        source_id = _clean_private_identity(getattr(source, "id", None))
        if not source_id:
            continue
        identity = catalog_source_identity(source)
        if identity is None:
            matches[source_id] = ExistingResultMatch(
                status=ExistingResultMatchStatus.indeterminate,
                accepted_output_count=0,
                matching_settings_count=0,
            )
            continue
        relevant = tuple(
            row for row in evidence_rows if row.source_identity == identity
        )
        matching_settings = tuple(
            row for row in relevant if row.settings == target_settings
        )
        if any(
            row.transcript_standard == CURRENT_TRANSCRIPT_STANDARD
            for row in matching_settings
        ):
            status = ExistingResultMatchStatus.accepted_match
        elif matching_settings:
            status = ExistingResultMatchStatus.standardization_required
        elif any(row.settings is None for row in relevant):
            status = ExistingResultMatchStatus.indeterminate
        else:
            status = ExistingResultMatchStatus.no_match
        matches[source_id] = ExistingResultMatch(
            status=status,
            accepted_output_count=len(relevant),
            matching_settings_count=len(matching_settings),
        )
    return matches


def load_existing_result_matches(
    db: Any,
    *,
    owner_user_id: str,
    sources: Iterable[Any],
    target_settings: EffectiveTranscriptionSettings,
) -> dict[str, ExistingResultMatch]:
    from sqlalchemy import and_, or_

    from .models import (
        Project,
        ProviderCredential,
        Source,
        SourceType,
        TranscriptionJob,
        TranscriptionJobOutput,
        TranscriptionJobSource,
    )

    source_rows = tuple(sources)
    source_ids = {
        identity.value
        for source in source_rows
        if (identity := catalog_source_identity(source)) is not None
        and identity.kind == CatalogSourceIdentityKind.studio_source
    }
    drive_file_ids = {
        identity.value
        for source in source_rows
        if (identity := catalog_source_identity(source)) is not None
        and identity.kind == CatalogSourceIdentityKind.google_drive_file
    }
    identity_filters = []
    if source_ids:
        identity_filters.append(Source.id.in_(source_ids))
    if drive_file_ids:
        identity_filters.append(
            and_(
                Source.source_type == SourceType.google_drive,
                Source.drive_file_id.in_(drive_file_ids),
            )
        )
    if not identity_filters:
        return classify_existing_results(
            sources=source_rows,
            evidence=(),
            target_settings=target_settings,
        )

    rows = (
        db.query(
            Source.id,
            Source.source_type,
            Source.drive_file_id,
            TranscriptionJob.provider,
            ProviderCredential.provider,
            TranscriptionJob.language,
            TranscriptionJob.options_json,
            TranscriptionJobOutput.output_kind,
            TranscriptionJobOutput.transcript_standard,
        )
        .join(
            TranscriptionJobSource,
            TranscriptionJobSource.source_id == Source.id,
        )
        .join(
            TranscriptionJob,
            TranscriptionJob.id == TranscriptionJobSource.job_id,
        )
        .join(
            TranscriptionJobOutput,
            TranscriptionJobOutput.job_source_id == TranscriptionJobSource.id,
        )
        .join(Project, Project.id == Source.project_id)
        .outerjoin(
            ProviderCredential,
            and_(
                ProviderCredential.id == TranscriptionJob.provider_credential_id,
                ProviderCredential.user_id == owner_user_id,
            ),
        )
        .filter(
            TranscriptionJob.owner_user_id == owner_user_id,
            Project.owner_user_id == owner_user_id,
            TranscriptionJob.project_id == Source.project_id,
            TranscriptionJobOutput.output_kind
            == GOOGLE_DOCS_TRANSCRIPT_OUTPUT_KIND,
            or_(*identity_filters),
        )
        .all()
    )
    return classify_existing_results(
        sources=source_rows,
        evidence=accepted_evidence_from_rows(rows),
        target_settings=target_settings,
    )


def has_competing_provider_attempt_conflict(
    db: Any,
    *,
    owner_user_id: str,
    sources: Iterable[Any],
    target_settings: EffectiveTranscriptionSettings,
    exclude_job_id: str,
) -> bool:
    """Return whether equivalent paid work is in flight or unresolved.

    Callers must hold the catalog-identity source locks while checking this and
    while durably marking their own provider request as started. That makes the
    first worker the only unapproved job allowed across the paid-call boundary.
    A failed or cancelled attempt also remains a conflict unless its outcome is
    explicitly classified retry-safe; a new job must not bypass uncertainty.
    """
    from sqlalchemy import and_, or_

    from .models import (
        JobStatus,
        Project,
        ProviderCredential,
        Source,
        SourceAttemptRetryDisposition,
        SourceType,
        TranscriptionJob,
        TranscriptionJobSource,
        TranscriptionJobSourceAttempt,
    )

    source_rows = tuple(sources)
    source_ids = {
        identity.value
        for source in source_rows
        if (identity := catalog_source_identity(source)) is not None
        and identity.kind == CatalogSourceIdentityKind.studio_source
    }
    drive_file_ids = {
        identity.value
        for source in source_rows
        if (identity := catalog_source_identity(source)) is not None
        and identity.kind == CatalogSourceIdentityKind.google_drive_file
    }
    identity_filters = []
    if source_ids:
        identity_filters.append(Source.id.in_(source_ids))
    if drive_file_ids:
        identity_filters.append(
            and_(
                Source.source_type == SourceType.google_drive,
                Source.drive_file_id.in_(drive_file_ids),
            )
        )
    if not identity_filters:
        return True

    rows = (
        db.query(
            TranscriptionJob.provider,
            ProviderCredential.provider,
            TranscriptionJob.language,
            TranscriptionJob.options_json,
            TranscriptionJob.status,
            TranscriptionJobSourceAttempt.retry_disposition,
        )
        .select_from(Source)
        .join(
            TranscriptionJobSource,
            TranscriptionJobSource.source_id == Source.id,
        )
        .join(
            TranscriptionJob,
            TranscriptionJob.id == TranscriptionJobSource.job_id,
        )
        .join(
            TranscriptionJobSourceAttempt,
            and_(
                TranscriptionJobSourceAttempt.job_id == TranscriptionJob.id,
                TranscriptionJobSourceAttempt.job_source_id
                == TranscriptionJobSource.id,
            ),
        )
        .join(Project, Project.id == Source.project_id)
        .outerjoin(
            ProviderCredential,
            and_(
                ProviderCredential.id
                == TranscriptionJob.provider_credential_id,
                ProviderCredential.user_id == owner_user_id,
            ),
        )
        .filter(
            TranscriptionJob.owner_user_id == owner_user_id,
            Project.owner_user_id == owner_user_id,
            TranscriptionJob.project_id == Source.project_id,
            TranscriptionJob.id != exclude_job_id,
            TranscriptionJobSourceAttempt.provider_request_started_at.is_not(
                None
            ),
            or_(*identity_filters),
        )
        .all()
    )
    for (
        job_provider,
        credential_provider,
        language,
        options_json,
        job_status,
        retry_disposition,
    ) in rows:
        settings = effective_settings_from_persisted_job(
            job_provider=job_provider,
            credential_provider=credential_provider,
            language=language,
            options_json=options_json,
        )
        settings_conflict = settings is None or settings == target_settings
        unresolved_attempt = (
            job_status == JobStatus.processing
            or retry_disposition
            != SourceAttemptRetryDisposition.retry_safe
        )
        if settings_conflict and unresolved_attempt:
            return True
    return False


def lock_catalog_source_identities(
    db: Any,
    *,
    owner_user_id: str,
    sources: Iterable[Any],
) -> tuple[Any, ...]:
    """Serialize create-time decisions with accepted-output persistence.

    Google Drive identity can span multiple Studio source rows, so locking only
    the currently selected row would leave a race with output persistence on an
    older row for the same Drive file. All matching owner-scoped source rows are
    locked in one deterministic order before the accepted-output query runs.
    """
    from sqlalchemy import and_, or_, select

    from .models import Project, Source, SourceType

    source_rows = tuple(sources)
    source_ids = {
        identity.value
        for source in source_rows
        if (identity := catalog_source_identity(source)) is not None
        and identity.kind == CatalogSourceIdentityKind.studio_source
    }
    drive_file_ids = {
        identity.value
        for source in source_rows
        if (identity := catalog_source_identity(source)) is not None
        and identity.kind == CatalogSourceIdentityKind.google_drive_file
    }
    identity_filters = []
    if source_ids:
        identity_filters.append(Source.id.in_(source_ids))
    if drive_file_ids:
        identity_filters.append(
            and_(
                Source.source_type == SourceType.google_drive,
                Source.drive_file_id.in_(drive_file_ids),
            )
        )
    if not identity_filters:
        return ()

    return tuple(
        db.execute(
            select(Source)
            .join(Project, Project.id == Source.project_id)
            .where(
                Project.owner_user_id == owner_user_id,
                or_(*identity_filters),
            )
            .order_by(Source.id.asc())
            # PostgreSQL FOR NO KEY UPDATE conflicts with the worker's source
            # FOR UPDATE while still allowing unrelated FK KEY SHARE access.
            .with_for_update(key_share=True, of=Source)
            .execution_options(populate_existing=True)
        )
        .scalars()
        .all()
    )


@dataclass(frozen=True)
class _SourceIdentityProjection:
    id: Any
    source_type: Any
    drive_file_id: Any


def _enum_value(value: Any) -> str:
    raw = getattr(value, "value", value)
    return raw if isinstance(raw, str) else ""


def _clean_private_identity(value: Any) -> str:
    return value.strip() if isinstance(value, str) and value.strip() else ""


def _catalog_language_mode(value: Any) -> str | None:
    normalized = value.strip().lower() if isinstance(value, str) else ""
    if (
        not normalized
        or len(normalized) > 40
        or not all(ch.isalnum() or ch in "_-" for ch in normalized)
    ):
        return None
    return normalized
