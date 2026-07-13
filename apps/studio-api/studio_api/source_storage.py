from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from enum import Enum
from pathlib import Path

from botocore.exceptions import ClientError

from .config import Settings


class SourceStorageError(RuntimeError):
    pass


class SourceObjectReadReason(str, Enum):
    missing = "missing"
    unavailable = "unavailable"


class SourceObjectReadError(RuntimeError):
    def __init__(self, reason: SourceObjectReadReason):
        self.reason = reason
        super().__init__(reason.value)


@dataclass
class SourceObjectStream:
    body: object
    content_type: str | None
    content_length: int | None

    def iter_chunks(self, chunk_size: int):
        while True:
            chunk = self.body.read(chunk_size)
            if not chunk:
                break
            yield chunk

    def close(self) -> None:
        close = getattr(self.body, "close", None)
        if close:
            close()


@dataclass(frozen=True)
class ObjectHead:
    size_bytes: int | None
    content_type: str | None


class S3SourceStorage:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.bucket = settings.source_s3_bucket
        if not settings.source_storage_configured():
            raise SourceStorageError("Временное хранилище источников не настроено")

        import boto3

        self.client = boto3.client(
            "s3",
            endpoint_url=settings.source_s3_endpoint_url,
            region_name=settings.source_s3_region,
            aws_access_key_id=Path(settings.source_s3_access_key_id_file).read_text(encoding="utf-8").strip(),
            aws_secret_access_key=Path(settings.source_s3_secret_access_key_file).read_text(encoding="utf-8").strip(),
        )

    def presigned_put_url(self, key: str, content_type: str, expires_seconds: int) -> str:
        return self.client.generate_presigned_url(
            "put_object",
            Params={"Bucket": self.bucket, "Key": key, "ContentType": content_type},
            ExpiresIn=expires_seconds,
        )

    def head_object(self, key: str) -> ObjectHead:
        try:
            result = self.client.head_object(Bucket=self.bucket, Key=key)
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code")
            if code in {"404", "NoSuchKey", "NotFound"}:
                raise FileNotFoundError(key) from exc
            raise
        return ObjectHead(size_bytes=result.get("ContentLength"), content_type=result.get("ContentType"))

    def open_read(self, key: str) -> SourceObjectStream:
        try:
            result = self.client.get_object(Bucket=self.bucket, Key=key)
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code")
            if code in {"404", "NoSuchKey", "NotFound"}:
                raise SourceObjectReadError(SourceObjectReadReason.missing) from exc
            raise SourceObjectReadError(SourceObjectReadReason.unavailable) from exc
        except Exception as exc:
            raise SourceObjectReadError(SourceObjectReadReason.unavailable) from exc
        return SourceObjectStream(result["Body"], result.get("ContentType"), result.get("ContentLength"))

    def delete_object(self, key: str) -> None:
        try:
            self.client.delete_object(Bucket=self.bucket, Key=key)
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code")
            if code in {"404", "NoSuchKey", "NotFound"}:
                return
            raise


def get_source_storage(settings: Settings) -> S3SourceStorage:
    return S3SourceStorage(settings)


SOURCE_DISPLAY_FILENAME_MAX_LENGTH = 255


def _truncate_preserving_extension(value: str, max_length: int) -> str:
    if len(value) <= max_length:
        return value
    stem, dot, extension = value.rpartition(".")
    if dot and stem and 1 < len(extension) <= 24 and len(extension) + 1 < max_length:
        return f"{stem[: max_length - len(extension) - 1].rstrip()} .{extension}".replace(" .", ".")
    return value[:max_length].rstrip()


def normalize_source_display_filename(name: str, max_length: int = SOURCE_DISPLAY_FILENAME_MAX_LENGTH) -> str:
    value = unicodedata.normalize("NFC", name or "")
    cleaned = []
    for char in value.replace("\\", "_").replace("/", "_"):
        category = unicodedata.category(char)
        if char in {"\n", "\r", "\x00"} or category.startswith("C"):
            continue
        cleaned.append(char)
    value = "".join(cleaned).strip()
    value = re.sub(r"[ 	]+", " ", value)
    value = _truncate_preserving_extension(value or "source", max_length).strip()
    return value or "source"


def safe_filename(name: str) -> str:
    value = (name or "source").strip().replace("\\", "_").replace("/", "_")
    value = re.sub(r"[^A-Za-z0-9._ -]+", "_", value).strip(" ._")
    return (value or "source")[:180]
