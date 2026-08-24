from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/studio-api"))

from studio_api.google_drive_upload import upload_file_resumable


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
    def put(self, *_args, **_kwargs): self.puts += 1; return Response(payload={"id": "file-id", "name": "result.flac", "webViewLink": "https://drive.google.com/file/d/file-id/view", "parents": ["folder-id"]})


def input_file():
    path = ROOT / "temp" / "audio-preparation-pytest" / "drive-upload.flac"
    path.parent.mkdir(exist_ok=True)
    path.write_bytes(b"audio")
    return path


def test_resumable_upload_reuses_existing_idempotent_drive_result():
    existing = {"id": "existing-id", "name": "result.flac", "webViewLink": "https://drive.google.com/file/d/existing-id/view", "parents": ["folder-id"]}
    client = Client(existing=existing)
    result = upload_file_resumable("token", folder_id="folder-id", path=input_file(), filename="result.flac", mime_type="audio/flac", idempotency_key="job-id", client_factory=lambda **_kwargs: client)
    assert result.file_id == "existing-id"
    assert client.posts == 0
    assert client.puts == 0


def test_resumable_upload_creates_once_after_empty_reconciliation():
    client = Client()
    result = upload_file_resumable("token", folder_id="folder-id", path=input_file(), filename="result.flac", mime_type="audio/flac", idempotency_key="job-id", client_factory=lambda **_kwargs: client)
    assert result.file_id == "file-id"
    assert client.posts == 1
    assert client.puts == 1
