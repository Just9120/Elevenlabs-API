from datetime import datetime, timezone
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps/studio-api"))

from studio_api.transcript_document_metadata import compact_provenance_lines, title_has_recording_date
from studio_api.transcript_catalog_scan import classify_transcript_document_standard
from studio_api.transcript_catalog_standardize import build_standardized_transcript_document_text


@pytest.mark.parametrize("title,expected", [
    ("Созвон 😀 23.10.2026", True), ("Синк 08.04.26", True),
    ("2026-10-05_16-02-20", True), ("2026_10_05", True),
    ("31.02.2026", False), ("2026-13-01", False),
    ("ID 123.10.202612", False), ("Без даты", False),
])
def test_title_date_is_display_hint_only(title, expected):
    assert title_has_recording_date(title) is expected


def test_new_dated_doc_and_standardization_are_compact_without_changing_speech(monkeypatch):
    monkeypatch.setenv("STUDIO_DATABASE_URL", "sqlite+pysqlite:///:memory:")
    from studio_api.job_google_docs_output import format_transcript_doc
    title = "Созвон 😀 23.10.2026"
    speech = "Спикер 1:\nПривет.\n\nПримечание: неоднозначные метки оставлены раздельными."
    doc = format_transcript_doc(title=title, transcript_text=speech, job_language="ru",
        detected_language_code=None, created_at=datetime(2026, 10, 23, tzinfo=timezone.utc),
        diarization_enabled=True, provenance_lines=("Source: private-uuid · file.mp4",
        "Recording date provenance: embedded_media_metadata"))
    assert doc.body == (f"{title}\n\nМетаданные транскрипта\nProvider: ElevenLabs\n"
        f"Model: scribe_v2\nLanguage: ru\n\nТранскрипция\n\n{speech}")
    authority = datetime(2026, 10, 23, tzinfo=timezone.utc)
    assert classify_transcript_document_standard(doc.body, authoritative_created_at=authority).value == "current"
    rewritten = build_standardized_transcript_document_text(document_name=title,
        existing_document_text=doc.body, created_time=authority.isoformat())
    assert rewritten == doc.body


def test_legacy_header_cleanup_preserves_clip_concat_and_warns_about_changed_timeline():
    legacy = ("Old\n\nTranscript metadata\nProvider: ElevenLabs\nModel: scribe_v2\n"
        "Language: ru\nSpeakers: yes\nCreated at: 2026-10-23T00:00:00Z\n"
        "Source: private-source-id · export.flac\nPreparation: private-preparation-id\n"
        "Timeline: prepared audio\nTransformations: {\"silence_enabled\":true,\"mono_mode\":\"mixdown\",\"output_format\":\"flac\"}\n"
        "Original source: [{\"source_id\":\"private-a\",\"filename\":\"A.wav\"},{\"source_id\":\"private-b\",\"filename\":\"B.wav\"}]\n"
        "Clip: 10-20 seconds; source timeline\n\nTranscript\n\nСпикер 1:\nРечь.\n\nПримечание: без аудиосверки.")
    title = "Созвон 23.10.2026"
    result = build_standardized_transcript_document_text(document_name=title, existing_document_text=legacy, created_time=None)
    for noise in ("private-", "Speakers:", "Created at:", "Preparation:", "Transformations:", "source_id"):
        assert noise not in result
    assert "Original source: A.wav → B.wav" in result
    for useful in ("файлы объединены", "паузы сокращены", "каналы смешаны в моно", "формат FLAC", "Timeline: prepared audio", "Clip: 10-20 seconds"):
        assert useful in result
    assert result.endswith("Спикер 1:\nРечь.\n\nПримечание: без аудиосверки.")
    assert classify_transcript_document_standard(legacy.replace("Transcript metadata", "Метаданные транскрипта").replace("\nTranscript\n", "\nТранскрипция\n")).value == "current"
    assert classify_transcript_document_standard(result).value == "current"
    assert build_standardized_transcript_document_text(document_name=title, existing_document_text=result, created_time=None) == result


@pytest.mark.parametrize("raw", ["invalid", "[]", "null", '{"mono_mode":[],"output_format":{}}'])
def test_unknown_legacy_processing_recipe_does_not_leak_json_or_fail(raw):
    lines = compact_provenance_lines(("Transformations: " + raw,))
    assert len(lines) == 1 and lines[0].startswith("Audio processing: подготовленное аудио")
    assert raw not in lines[0]
