from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys

import pytest


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))

from studio_api.direct_drive_upload import (
    DIRECT_DRIVE_UPLOAD_APP_PROPERTY,
    DIRECT_DRIVE_UPLOAD_MAX_FILES,
    DirectDriveUploadError,
    DirectDriveUploadReason,
    decode_direct_drive_upload_capability,
    direct_drive_upload_descriptor_digest,
    encode_direct_drive_upload_capability,
    normalize_direct_drive_upload_descriptor,
    validate_direct_drive_upload_batch,
    verify_direct_drive_upload_result,
)


NOW = datetime(2026, 8, 28, 18, 0, tzinfo=timezone.utc)
OPERATION_ID = "123e4567-e89b-42d3-a456-426614174000"


def descriptor(**changes):
    values = {
        "operation_id": OPERATION_ID,
        "original_filename": "Короткая запись.wav",
        "mime_type": "audio/wav",
        "size_bytes": 5,
        "max_file_bytes": 100,
    }
    values.update(changes)
    return normalize_direct_drive_upload_descriptor(**values)


def drive_payload(**changes):
    values = {
        "id": "drive-file-id",
        "name": "Короткая запись.wav",
        "mimeType": "audio/wav",
        "size": "5",
        "webViewLink": "https://drive.google.com/file/d/drive-file-id/view",
        "parents": ["folder-id"],
        "appProperties": {DIRECT_DRIVE_UPLOAD_APP_PROPERTY: OPERATION_ID},
        "trashed": False,
    }
    values.update(changes)
    return values


def test_descriptor_and_batch_enforce_media_bounds_and_unique_operations():
    item = descriptor(mime_type=" Audio/WAV ")
    assert item.mime_type == "audio/wav"
    validate_direct_drive_upload_batch([item])

    with pytest.raises(ValueError, match="mime"):
        descriptor(mime_type="text/plain")
    with pytest.raises(ValueError, match="filename"):
        descriptor(original_filename="../private.wav")
    with pytest.raises(ValueError, match="size"):
        descriptor(size_bytes=101)
    with pytest.raises(ValueError, match="duplicate"):
        validate_direct_drive_upload_batch([item, item])
    with pytest.raises(ValueError, match="file count"):
        validate_direct_drive_upload_batch(
            [
                descriptor(
                    operation_id=f"123e4567-e89b-42d3-a456-{index:012x}"
                )
                for index in range(DIRECT_DRIVE_UPLOAD_MAX_FILES + 1)
            ]
        )


def test_signed_capability_binds_owner_project_folder_and_descriptor_and_expires():
    item = descriptor()
    token = encode_direct_drive_upload_capability(
        item,
        owner_user_id="owner-id",
        project_id="project-id",
        folder_id="folder-id",
        secret="session-secret",
        now=NOW,
    )
    decoded = decode_direct_drive_upload_capability(
        token,
        secret="session-secret",
        now=NOW + timedelta(minutes=5),
    )

    assert decoded is not None
    assert decoded.operation_id == OPERATION_ID
    assert decoded.owner_user_id == "owner-id"
    assert decoded.project_id == "project-id"
    assert decoded.folder_id == "folder-id"
    assert decoded.descriptor_digest == direct_drive_upload_descriptor_digest(item)
    assert decode_direct_drive_upload_capability(
        token,
        secret="other-session",
        now=NOW,
    ) is None
    assert decode_direct_drive_upload_capability(
        token,
        secret="session-secret",
        now=NOW + timedelta(hours=2),
    ) is None


def test_result_verification_requires_exact_parent_metadata_and_idempotency_marker():
    result = verify_direct_drive_upload_result(
        "access-token",
        file_id="drive-file-id",
        folder_id="folder-id",
        descriptor=descriptor(),
        metadata_fetcher=lambda *_args: drive_payload(),
    )
    assert result.name == "Короткая запись.wav"
    assert result.mime_type == "audio/wav"
    assert result.size_bytes == 5
    assert result.web_view_url.startswith("https://drive.google.com/file/d/")

    for changed in (
        {"parents": ["other-folder"]},
        {"size": "6"},
        {"mimeType": "audio/mpeg"},
        {"appProperties": {DIRECT_DRIVE_UPLOAD_APP_PROPERTY: "other"}},
        {"trashed": True},
        {"webViewLink": "https://evil.test/file/d/drive-file-id/view"},
    ):
        with pytest.raises(DirectDriveUploadError) as exc:
            verify_direct_drive_upload_result(
                "access-token",
                file_id="drive-file-id",
                folder_id="folder-id",
                descriptor=descriptor(),
                metadata_fetcher=lambda *_args, changed=changed: drive_payload(
                    **changed
                ),
            )
        assert exc.value.reason == DirectDriveUploadReason.metadata_mismatch
