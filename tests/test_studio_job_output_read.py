import enum
import sys
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps/studio-api"))

from studio_api.job_output_read import OUTPUT_ENTRY_KEYS, browser_job_output_payload, normalize_google_web_view_url


class FakeSourceType(str, enum.Enum):
    google_drive = "google_drive"


class FakeOutputKind(str, enum.Enum):
    transcript = "google_doc_transcript"


def test_approved_docs_google_https_url():
    assert normalize_google_web_view_url("https://docs.google.com/document/d/abc/edit") == "https://docs.google.com/document/d/abc/edit"


def test_approved_drive_google_https_url():
    assert normalize_google_web_view_url("https://drive.google.com/file/d/abc/view") == "https://drive.google.com/file/d/abc/view"


def test_host_and_scheme_normalization():
    assert normalize_google_web_view_url("HTTPS://DOCS.GOOGLE.COM/document/d/abc") == "https://docs.google.com/document/d/abc"


def test_path_query_fragment_preservation():
    assert normalize_google_web_view_url("https://docs.google.com/a/b?x=1#frag") == "https://docs.google.com/a/b?x=1#frag"


def test_missing_and_empty_values_return_null():
    assert normalize_google_web_view_url(None) is None
    assert normalize_google_web_view_url("") is None
    assert normalize_google_web_view_url("   ") is None


def test_http_rejected():
    assert normalize_google_web_view_url("http://docs.google.com/document/d/abc") is None


def test_protocol_relative_rejected():
    assert normalize_google_web_view_url("//docs.google.com/document/d/abc") is None


def test_unsafe_schemes_rejected():
    for value in ["javascript:alert(1)", "data:text/plain,secret", "file:///tmp/secret", "blob:https://docs.google.com/abc"]:
        assert normalize_google_web_view_url(value) is None


def test_localhost_and_ip_literals_rejected():
    for value in ["https://localhost/doc", "https://127.0.0.1/doc", "https://[::1]/doc"]:
        assert normalize_google_web_view_url(value) is None


def test_suffix_and_prefix_hostname_tricks_rejected():
    for value in ["https://docs.google.com.evil.test/doc", "https://evil-docs.google.com/doc"]:
        assert normalize_google_web_view_url(value) is None


def test_trailing_dot_hostname_rejected():
    assert normalize_google_web_view_url("https://docs.google.com./doc") is None


def test_embedded_username_password_rejected():
    assert normalize_google_web_view_url("https://user@docs.google.com/doc") is None
    assert normalize_google_web_view_url("https://user:password@docs.google.com/doc") is None


def test_explicit_default_port_443_rejected():
    assert normalize_google_web_view_url("https://docs.google.com:443/doc") is None


def test_custom_ports_rejected():
    assert normalize_google_web_view_url("https://docs.google.com:8443/doc") is None


def test_malformed_port_fails_closed():
    assert normalize_google_web_view_url("https://docs.google.com:bad/doc") is None


def test_empty_port_delimiter_fails_closed():
    assert normalize_google_web_view_url("https://docs.google.com:/doc") is None


def test_unsafe_secret_bearing_url_is_never_returned():
    secret_url = "https://user:secret-token@docs.google.com/document/d/abc"
    assert normalize_google_web_view_url(secret_url) is None


def output_fixture(url="https://docs.google.com/document/d/abc/edit"):
    created = datetime(2026, 7, 11, 1, 2, 3, tzinfo=timezone.utc)
    persisted = datetime(2026, 7, 11, 1, 3, 4, tzinfo=timezone.utc)
    output = SimpleNamespace(
        id="secret-output-id",
        job_source_id="secret-job-source-id",
        document_id="secret-doc-id",
        web_view_url=url,
        output_drive_folder_id="secret-folder-id",
        output_kind=FakeOutputKind.transcript,
        transcript_standard="transcript_doc_v1.2",
        document_character_count=123,
        document_created_at=created,
        persisted_at=persisted,
        lease_generation=99,
        transcript_text="secret transcript",
        token="secret-token",
    )
    job_source = SimpleNamespace(id="secret-job-source-id", source_id="source-1", position=7)
    source = SimpleNamespace(
        id="source-1",
        source_type=FakeSourceType.google_drive,
        original_filename="meeting.mp4",
        drive_file_id="secret-drive-id",
        drive_file_url="https://drive.google.com/secret",
        s3_bucket="secret-bucket",
        s3_object_key="secret-key",
    )
    return output, job_source, source


def test_serializer_returns_exactly_approved_key_set():
    assert set(browser_job_output_payload(*output_fixture())) == OUTPUT_ENTRY_KEYS


def test_serializer_converts_enums_and_datetimes_using_api_conventions():
    body = browser_job_output_payload(*output_fixture())
    assert body["source_type"] == "google_drive"
    assert body["output_kind"] == "google_doc_transcript"
    assert body["document_created_at"] == "2026-07-11T01:02:03+00:00"
    assert body["persisted_at"] == "2026-07-11T01:03:04+00:00"


def test_serializer_never_includes_forbidden_internal_fields_or_secret_values():
    body = browser_job_output_payload(*output_fixture())
    text = repr(body)
    for key in ["document_id", "output_drive_folder_id", "lease_generation", "job_source_id", "drive_file_id", "drive_file_url", "s3_bucket", "s3_object_key", "transcript_text", "token"]:
        assert key not in body
    for value in ["secret-doc-id", "secret-folder-id", "secret-drive-id", "secret-bucket", "secret-key", "secret transcript", "secret-token"]:
        assert value not in text


def test_unsafe_url_preserves_non_link_metadata_and_sets_null_url():
    body = browser_job_output_payload(*output_fixture("https://user:secret-token@docs.google.com/document/d/abc"))
    assert body["source_id"] == "source-1"
    assert body["source_position"] == 7
    assert body["source_name"] == "meeting.mp4"
    assert body["web_view_url"] is None
    assert body["link_available"] is False
    assert "secret-token" not in repr(body)
