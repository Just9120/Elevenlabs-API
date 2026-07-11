from __future__ import annotations

from urllib.parse import urlsplit, urlunsplit


_ALLOWED_GOOGLE_WEB_VIEW_HOSTS = {"docs.google.com", "drive.google.com"}
OUTPUT_ENTRY_KEYS = {
    "source_id",
    "source_position",
    "source_name",
    "source_type",
    "output_kind",
    "transcript_standard",
    "web_view_url",
    "link_available",
    "document_character_count",
    "document_created_at",
    "persisted_at",
}


def _enum_value(value):
    return value.value if hasattr(value, "value") else value


def _iso_or_none(value):
    return value.isoformat() if value is not None else None


def normalize_google_web_view_url(value) -> str | None:
    if not isinstance(value, str):
        return None
    raw = value.strip()
    if not raw or raw.startswith("//"):
        return None
    try:
        parsed = urlsplit(raw)
        if parsed.scheme.lower() != "https":
            return None
        hostname = parsed.hostname
        if hostname is None or hostname != hostname.lower() or hostname not in _ALLOWED_GOOGLE_WEB_VIEW_HOSTS:
            return None
        if parsed.username is not None or parsed.password is not None:
            return None
        if parsed.port is not None:
            return None
    except (TypeError, ValueError):
        return None
    return urlunsplit(("https", hostname, parsed.path, parsed.query, parsed.fragment))


def browser_job_output_payload(output, job_source, source) -> dict:
    web_view_url = normalize_google_web_view_url(output.web_view_url)
    return {
        "source_id": job_source.source_id,
        "source_position": job_source.position,
        "source_name": source.original_filename,
        "source_type": _enum_value(source.source_type),
        "output_kind": _enum_value(output.output_kind),
        "transcript_standard": _enum_value(output.transcript_standard),
        "web_view_url": web_view_url,
        "link_available": web_view_url is not None,
        "document_character_count": output.document_character_count,
        "document_created_at": _iso_or_none(output.document_created_at),
        "persisted_at": _iso_or_none(output.persisted_at),
    }


def load_browser_job_output_rows(db, job_id: str):
    from .models import Source, TranscriptionJobOutput, TranscriptionJobSource

    return (
        db.query(TranscriptionJobOutput, TranscriptionJobSource, Source)
        .filter(TranscriptionJobOutput.job_id == job_id)
        .filter(TranscriptionJobOutput.job_source_id == TranscriptionJobSource.id)
        .filter(TranscriptionJobSource.job_id == job_id)
        .filter(TranscriptionJobSource.source_id == Source.id)
        .order_by(
            TranscriptionJobSource.position.asc(),
            TranscriptionJobOutput.persisted_at.asc(),
            TranscriptionJobOutput.id.asc(),
        )
        .all()
    )
