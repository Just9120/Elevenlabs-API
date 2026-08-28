import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))


def test_versionless_localized_transcript_document_contract():
    from studio_api.transcript_document import (
        TRANSCRIPT_DOCUMENT_STANDARD,
        build_transcript_document_text,
    )

    document = build_transcript_document_text(
        title="Созвон",
        metadata_lines=(
            "Provider: ElevenLabs",
            "Model: scribe_v2",
            "Language: ru",
            "Speakers: yes",
            "Created at: 2026-08-28T12:00:00Z",
        ),
        transcript_text="Speaker 1:\r\nПривет\r\n\r\nSpeaker 2:\r\nМир",
    )

    assert TRANSCRIPT_DOCUMENT_STANDARD == "transcript_doc"
    assert document == (
        "Созвон\n\nМетаданные транскрипта\n"
        "Provider: ElevenLabs\nModel: scribe_v2\nLanguage: ru\n"
        "Speakers: yes\nCreated at: 2026-08-28T12:00:00Z\n\n"
        "Транскрипция\n\nСпикер 1:\nПривет\n\nСпикер 2:\nМир"
    )
    assert "transcript_doc_v" not in document
    assert "Transcript metadata" not in document


def test_style_requests_use_heading_body_and_speaker_contract_with_utf16():
    from studio_api.transcript_document import (
        build_transcript_document_style_requests,
        build_transcript_document_text,
    )

    document = build_transcript_document_text(
        title="🎙️ Созвон",
        metadata_lines=(
            "Provider: ElevenLabs",
            "Model: scribe_v2",
            "Language: ru",
            "Speakers: yes",
            "Created at: 2026-08-28T12:00:00Z",
        ),
        transcript_text="Спикер 1:\nПривет 👋\n\nСпикер 2:\nМир",
    )
    requests = build_transcript_document_style_requests(
        document,
        tab_id="private-tab",
    )

    heading = requests[0]["updateParagraphStyle"]
    assert heading["paragraphStyle"] == {"namedStyleType": "HEADING_2"}
    assert heading["fields"] == "namedStyleType"
    assert heading["range"] == {
        "startIndex": 1,
        "endIndex": 1 + len("🎙️ Созвон\n".encode("utf-16-le")) // 2,
        "tabId": "private-tab",
    }

    body = requests[1]["updateTextStyle"]
    assert body["textStyle"] == {
        "bold": False,
        "fontSize": {"magnitude": 11, "unit": "PT"},
    }
    assert body["fields"] == "bold,fontSize"
    body_offset = document.index("Транскрипция\n\n") + len("Транскрипция\n\n")
    assert body["range"]["startIndex"] == 1 + len(
        document[:body_offset].encode("utf-16-le")
    ) // 2
    assert body["range"]["endIndex"] == 1 + len(
        document.encode("utf-16-le")
    ) // 2

    speakers = [request["updateTextStyle"] for request in requests[2:]]
    assert len(speakers) == 2
    for speaker in speakers:
        assert speaker["textStyle"] == {
            "bold": True,
            "fontSize": {"magnitude": 14, "unit": "PT"},
        }
        assert speaker["fields"] == "bold,fontSize"
        assert speaker["range"]["tabId"] == "private-tab"


@pytest.mark.parametrize(
    "document_text",
    ("", "Title only", "Title\n\nTranscript\n\nBody"),
)
def test_style_request_builder_rejects_noncanonical_text(document_text):
    from studio_api.transcript_document import (
        build_transcript_document_style_requests,
    )

    with pytest.raises(ValueError):
        build_transcript_document_style_requests(document_text)
