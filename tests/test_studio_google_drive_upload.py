from pathlib import Path
import sys
import httpx
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))

from studio_api.google_drive_upload import GoogleDriveUploadError, upload_file_resumable


class Response:
    def __init__(self, status_code=200, payload=None, headers=None):
        self.status_code = status_code
        self._payload = payload or {}
        self.headers = headers or {}
    def json(self): return self._payload


class Client:
    def __init__(self, *, existing=None): self.existing = existing; self.posts = 0; self.puts = 0
    def __enter__(self): return self
    def __exit__(self, *_args): return None
    def get(self, *_args, **_kwargs): return Response(payload={"files": [self.existing] if self.existing else []})
    def post(self, *_args, **_kwargs): self.posts += 1; return Response(headers={"Location": "https://www.googleapis.com/upload/drive/v3/files?upload_id=safe-id"})
    def put(self, *_args, **_kwargs): self.puts += 1; return Response(payload={"id": "file-id", "name": "result.flac", "size": "5", "webViewLink": "https://drive.google.com/file/d/file-id/view", "parents": ["folder-id"]})


def input_file(tmp_path):
    path = tmp_path / "drive-upload.flac"
    path.write_bytes(b"audio")
    return path


def test_resumable_upload_reuses_existing_idempotent_drive_result(tmp_path):
    existing = {"id": "existing-id", "name": "result.flac", "size": "5", "webViewLink": "https://drive.google.com/file/d/existing-id/view", "parents": ["folder-id"]}
    client = Client(existing=existing)
    result = upload_file_resumable("token", folder_id="folder-id", path=input_file(tmp_path), filename="result.flac", mime_type="audio/flac", idempotency_key="job-id", client_factory=lambda **_kwargs: client)
    assert result.file_id == "existing-id"
    assert client.posts == 0
    assert client.puts == 0


def test_resumable_upload_creates_once_after_empty_reconciliation(tmp_path):
    client = Client()
    result = upload_file_resumable("token", folder_id="folder-id", path=input_file(tmp_path), filename="result.flac", mime_type="audio/flac", idempotency_key="job-id", client_factory=lambda **_kwargs: client)
    assert result.file_id == "file-id"
    assert client.posts == 1
    assert client.puts == 1


def _upload(tmp_path, client, **kwargs):
    return upload_file_resumable("token", folder_id="folder-id", path=input_file(tmp_path), filename="result.flac",
        mime_type="audio/flac", idempotency_key="job-id", client_factory=lambda **_kwargs: client, **kwargs)


class ScriptedClient(Client):
    def __init__(self, responses):
        super().__init__()
        self.responses = iter(responses)
        self.requests = []
    def put(self, _url, **kwargs):
        self.puts += 1
        self.requests.append(kwargs)
        response = next(self.responses)
        if isinstance(response, Exception):
            raise response
        return response


def complete_response():
    return Client().put()


def test_chunk_ranges_resume_from_confirmed_offset_after_interruption(tmp_path):
    client = ScriptedClient([httpx.ReadTimeout("response lost"), Response(308, headers={"Range": "bytes=0-1"}), complete_response()])
    progress = []
    _upload(tmp_path, client, progress_callback=lambda sent, total: progress.append((sent, total)))
    assert [request["headers"]["Content-Range"] for request in client.requests] == ["bytes 0-4/5", "bytes */5", "bytes 2-4/5"]
    assert client.requests[-1]["content"] == b"dio"
    assert progress == [(2, 5)]
    assert client.posts == 1


def test_lost_final_response_reconciles_same_session_without_another_create(tmp_path):
    client = ScriptedClient([Response(503), complete_response()])
    assert _upload(tmp_path, client).file_id == "file-id"
    assert client.posts == 1 and client.puts == 2
    assert client.requests[-1]["content"] == b""


@pytest.mark.parametrize("range_header", ["bytes=1-2", "bytes=0-5", "invalid"])
def test_malformed_acknowledgement_never_reports_success(tmp_path, range_header):
    with pytest.raises(GoogleDriveUploadError):
        _upload(tmp_path, ScriptedClient([Response(308, headers={"Range": range_header})]))


def test_no_progress_is_bounded(tmp_path):
    client = ScriptedClient([Response(308)] * 3)
    with pytest.raises(GoogleDriveUploadError):
        _upload(tmp_path, client)
    assert client.puts == 3 and client.posts == 1


def test_cancellation_between_chunks_stops_external_work(tmp_path):
    client = ScriptedClient([Response(308, headers={"Range": "bytes=0-1"})])
    cancelled = False
    def check():
        if cancelled:
            raise RuntimeError("cancelled")
    def progress(*_args):
        nonlocal cancelled
        cancelled = True
    with pytest.raises(RuntimeError, match="cancelled"):
        _upload(tmp_path, client, check_cancelled=check, progress_callback=progress)
    assert client.puts == 1


def test_wrong_size_existing_copy_is_not_accepted(tmp_path):
    existing = complete_response().json() | {"size": "4"}
    client = Client(existing=existing)
    with pytest.raises(GoogleDriveUploadError):
        _upload(tmp_path, client)
    assert client.posts == 0


def test_large_file_uses_multiple_bounded_chunks(tmp_path, monkeypatch):
    monkeypatch.setattr("studio_api.google_drive_upload.DRIVE_UPLOAD_CHUNK_SIZE", 256 * 1024)
    path = tmp_path / "large.flac"
    path.write_bytes(b"x" * (256 * 1024 + 1))
    final = complete_response()
    final._payload["size"] = str(path.stat().st_size)
    client = ScriptedClient([Response(308, headers={"Range": "bytes=0-262143"}), final])
    upload_file_resumable("token", folder_id="folder-id", path=path, filename="result.flac", mime_type="audio/flac", idempotency_key="job-id", client_factory=lambda **kwargs: client)
    assert [len(r["content"]) for r in client.requests] == [256 * 1024, 1]
