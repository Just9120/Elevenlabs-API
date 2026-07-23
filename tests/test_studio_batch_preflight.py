from __future__ import annotations

import json
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))


def test_batch_preflight_payload_is_ordered_explicit_and_browser_safe():
    from studio_api.batch_preflight import build_batch_preflight_payload
    from studio_api.transcript_catalog import (
        ExistingResultMatch,
        ExistingResultMatchStatus,
    )

    sources = [
        SimpleNamespace(
            id="private-source-a",
            source_type=SimpleNamespace(value="google_drive"),
            original_filename=" Interview.mp4 ",
            mime_type="video/mp4",
            size_bytes=2048,
            drive_file_id="private-drive-id",
            drive_file_url="https://drive.google.com/private-source",
            s3_bucket="private-bucket",
            s3_object_key="private/object/key",
        ),
        SimpleNamespace(
            id="private-source-b",
            source_type=SimpleNamespace(value="local_upload"),
            original_filename="Local.ogg",
            mime_type=None,
            size_bytes=None,
            s3_object_key="private/local/key",
        ),
    ]
    folders = [
        SimpleNamespace(
            id="private-folder-a",
            name="Results A",
            web_view_url="https://drive.google.com/private-folder-a",
        ),
        SimpleNamespace(id="private-folder-b", name=None, web_view_url=None),
    ]

    payload = build_batch_preflight_payload(
        sources=sources,
        output_folders=folders,
        titles=["First", None],
        language_mode="detect",
        diarization_enabled=True,
        existing_result_matches={
            "private-source-a": ExistingResultMatch(
                status=ExistingResultMatchStatus.accepted_match,
                accepted_output_count=1,
                matching_settings_count=1,
            ),
            "private-source-b": ExistingResultMatch(
                status=ExistingResultMatchStatus.standardization_required,
                accepted_output_count=2,
                matching_settings_count=2,
            ),
        },
        reprocess_existing=[False, True],
    )

    assert set(payload) == {
        "provider",
        "model",
        "language_mode",
        "diarization_enabled",
        "existing_result_authority",
        "items",
        "summary",
        "confirmation_required",
    }
    assert payload["provider"] == "elevenlabs"
    assert payload["model"] == "scribe_v2"
    assert payload["summary"] == {
        "process_count": 1,
        "skip_count": 0,
        "blocked_count": 1,
    }
    assert payload["existing_result_authority"] == {
        "status": "partial",
        "reason_code": "studio_outputs_only",
    }
    assert [item["position"] for item in payload["items"]] == [0, 1]
    assert payload["items"][0] == {
        "position": 0,
        "title": "First",
        "source": {
            "name": "Interview.mp4",
            "source_type": "google_drive",
            "mime_type": "video/mp4",
            "size_bytes": 2048,
            "duration_seconds": None,
        },
        "output_destination": {"name": "Results A"},
        "existing_result_match": {
            "status": "accepted_match",
            "accepted_output_count": 1,
            "resolution": "required",
        },
        "planned_outcome": "blocked",
    }
    assert payload["items"][1]["output_destination"] == {
        "name": "Папка Google Drive"
    }
    assert payload["items"][1]["existing_result_match"] == {
        "status": "standardization_required",
        "accepted_output_count": 2,
        "resolution": "reprocess",
    }
    assert payload["items"][1]["planned_outcome"] == "process"
    encoded = json.dumps(payload)
    for private_value in (
        "private-drive-id",
        "private-source",
        "private-bucket",
        "private/object/key",
        "private/local/key",
        "private-folder-a",
        "private-folder-b",
        "private-source-a",
        "private-source-b",
    ):
        assert private_value not in encoded


def test_batch_preflight_payload_rejects_misaligned_validated_inputs():
    from studio_api.batch_preflight import build_batch_preflight_payload

    with pytest.raises(ValueError, match="equal lengths"):
        build_batch_preflight_payload(
            sources=[SimpleNamespace()],
            output_folders=[],
            titles=[None],
            language_mode="ru",
            diarization_enabled=False,
            existing_result_matches={},
            reprocess_existing=[False],
        )


def test_batch_preflight_payload_fails_closed_without_catalog_decision():
    from studio_api.batch_preflight import build_batch_preflight_payload

    with pytest.raises(ValueError, match="catalog decision"):
        build_batch_preflight_payload(
            sources=[SimpleNamespace(id="private-source")],
            output_folders=[SimpleNamespace(name="Safe folder")],
            titles=[None],
            language_mode="ru",
            diarization_enabled=False,
            existing_result_matches={},
            reprocess_existing=[False],
        )
