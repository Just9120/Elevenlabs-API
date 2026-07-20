from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Mapping
from urllib.parse import urlencode

import httpx

GOOGLE_DOC_MIME_TYPE = "application/vnd.google-apps.document"
GOOGLE_DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files"
OUTPUT_RECONCILIATION_APP_PROPERTY = "studioOutputReconciliationToken"


class GoogleDocsOutputReason(str, Enum):
    authentication_rejected = "authentication_rejected"
    request_rejected = "request_rejected"
    rate_limited = "rate_limited"
    unavailable = "unavailable"
    timeout = "timeout"
    malformed_response = "malformed_response"
    context_closed = "context_closed"


class GoogleDocsOutputError(RuntimeError):
    def __init__(self, reason: GoogleDocsOutputReason):
        self.reason = reason
        super().__init__(reason.value)


@dataclass(frozen=True)
class GoogleDocsCreateResult:
    document_id: str = field(repr=False)
    name: str = field(repr=False)
    mime_type: str
    web_view_link: str = field(repr=False)
    parents: tuple[str, ...] = field(repr=False)

    def __repr__(self) -> str:
        return "GoogleDocsCreateResult(document_id=<redacted>, name=<redacted>, mime_type=%r, web_view_link=<redacted>, parents=<redacted>)" % self.mime_type


class _RevocableArtifact:
    def __init__(self, document_id: str, web_view_link: str, output_folder_id: str):
        self._document_id = document_id
        self._web_view_link = web_view_link
        self._output_folder_id = output_folder_id
        self._revoked = False

    def document_id(self) -> str:
        if self._revoked:
            raise GoogleDocsOutputError(GoogleDocsOutputReason.context_closed)
        return self._document_id

    def web_view_link(self) -> str:
        if self._revoked:
            raise GoogleDocsOutputError(GoogleDocsOutputReason.context_closed)
        return self._web_view_link

    def output_folder_id(self) -> str:
        if self._revoked:
            raise GoogleDocsOutputError(GoogleDocsOutputReason.context_closed)
        return self._output_folder_id

    def revoke(self) -> None:
        self._document_id = ""
        self._web_view_link = ""
        self._output_folder_id = ""
        self._revoked = True


@dataclass(frozen=True)
class GoogleDocsTranscriptArtifact:
    _holder: _RevocableArtifact = field(repr=False)
    created_at: datetime
    character_count: int

    @property
    def document_id(self) -> str:
        return self._holder.document_id()

    @property
    def web_view_link(self) -> str:
        return self._holder.web_view_link()

    @property
    def output_folder_id(self) -> str:
        return self._holder.output_folder_id()

    def revoke(self) -> None:
        self._holder.revoke()

    def __repr__(self) -> str:
        return f"GoogleDocsTranscriptArtifact(document_id=<redacted>, web_view_link=<redacted>, title=<redacted>, folder_id=<redacted>, body=<redacted>, created_at={self.created_at!r}, character_count={self.character_count!r})"


@dataclass(frozen=True)
class GoogleDocsTranscriptTransport:
    endpoint: str = GOOGLE_DRIVE_UPLOAD_URL
    timeout: float = 30.0
    client: httpx.Client | None = field(default=None, repr=False)
    post: Callable[..., httpx.Response] | None = field(default=None, repr=False)

    def create_transcript_document(self, *, access_token: str, folder_id: str, title: str, document_text: str, reconciliation_token: str | None = None) -> GoogleDocsCreateResult:
        boundary = f"studio-doc-{uuid.uuid4().hex}"
        body = _multipart_body(boundary, title=title, folder_id=folder_id, document_text=document_text, reconciliation_token=reconciliation_token)
        params = urlencode({"uploadType": "multipart", "supportsAllDrives": "true", "fields": "id,name,mimeType,webViewLink,parents"})
        url = f"{self.endpoint}?{params}"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": f"multipart/related; boundary={boundary}",
            "Accept": "application/json",
        }
        try:
            if self.post is not None:
                response = self.post(url, headers=headers, content=body, timeout=self.timeout)
            elif self.client is not None:
                response = self.client.post(url, headers=headers, content=body, timeout=self.timeout)
            else:
                with httpx.Client() as client:
                    response = client.post(url, headers=headers, content=body, timeout=self.timeout)
        except httpx.TimeoutException as exc:
            raise GoogleDocsOutputError(GoogleDocsOutputReason.timeout) from exc
        except httpx.HTTPError as exc:
            raise GoogleDocsOutputError(GoogleDocsOutputReason.unavailable) from exc
        if response.status_code in {401, 403}:
            raise GoogleDocsOutputError(GoogleDocsOutputReason.authentication_rejected)
        if response.status_code in {400, 404, 409, 422}:
            raise GoogleDocsOutputError(GoogleDocsOutputReason.request_rejected)
        if response.status_code == 429:
            raise GoogleDocsOutputError(GoogleDocsOutputReason.rate_limited)
        if response.status_code >= 500:
            raise GoogleDocsOutputError(GoogleDocsOutputReason.unavailable)
        try:
            payload = response.json()
        except Exception as exc:
            raise GoogleDocsOutputError(GoogleDocsOutputReason.malformed_response) from exc
        return normalize_google_docs_create_response(payload, expected_folder_id=folder_id)

    def __repr__(self) -> str:
        return f"GoogleDocsTranscriptTransport(endpoint={self.endpoint!r})"


def normalize_google_docs_create_response(payload: Any, *, expected_folder_id: str) -> GoogleDocsCreateResult:
    if not isinstance(payload, Mapping):
        raise GoogleDocsOutputError(GoogleDocsOutputReason.malformed_response)
    doc_id = payload.get("id")
    name = payload.get("name")
    mime_type = payload.get("mimeType")
    web_view_link = payload.get("webViewLink")
    parents_raw = payload.get("parents")
    if not isinstance(doc_id, str) or not doc_id.strip():
        raise GoogleDocsOutputError(GoogleDocsOutputReason.malformed_response)
    if not isinstance(name, str):
        raise GoogleDocsOutputError(GoogleDocsOutputReason.malformed_response)
    if mime_type != GOOGLE_DOC_MIME_TYPE:
        raise GoogleDocsOutputError(GoogleDocsOutputReason.malformed_response)
    if not isinstance(web_view_link, str) or not web_view_link.strip():
        raise GoogleDocsOutputError(GoogleDocsOutputReason.malformed_response)
    if not isinstance(parents_raw, list) or expected_folder_id not in parents_raw or not all(isinstance(p, str) for p in parents_raw):
        raise GoogleDocsOutputError(GoogleDocsOutputReason.malformed_response)
    return GoogleDocsCreateResult(doc_id, name, mime_type, web_view_link, tuple(parents_raw))


def new_google_docs_transcript_artifact(*, result: GoogleDocsCreateResult, created_at: datetime, character_count: int) -> GoogleDocsTranscriptArtifact:
    return GoogleDocsTranscriptArtifact(_RevocableArtifact(result.document_id, result.web_view_link, result.parents[0]), created_at, character_count)


def _multipart_body(boundary: str, *, title: str, folder_id: str, document_text: str, reconciliation_token: str | None = None) -> bytes:
    metadata = {"name": title, "mimeType": GOOGLE_DOC_MIME_TYPE, "parents": [folder_id]}
    if reconciliation_token:
        metadata["appProperties"] = {OUTPUT_RECONCILIATION_APP_PROPERTY: reconciliation_token}
    chunks = [
        f"--{boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n".encode("utf-8"),
        json.dumps(metadata, ensure_ascii=False, separators=(",", ":")).encode("utf-8"),
        f"\r\n--{boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n".encode("utf-8"),
        document_text.encode("utf-8"),
        f"\r\n--{boundary}--\r\n".encode("utf-8"),
    ]
    return b"".join(chunks)
