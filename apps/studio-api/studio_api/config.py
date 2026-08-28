from functools import lru_cache
from pathlib import Path
from urllib.parse import quote_plus
from pydantic import Field, IPvAnyAddress, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="STUDIO_", env_file=".env", extra="ignore")
    environment: str = "production"
    database_url: str | None = None
    database_scheme: str = "postgresql+psycopg"
    database_host: str = "postgres"
    database_port: int = 5432
    database_name: str = "studio"
    database_user: str = "studio"
    # The PostgreSQL password is read from a mounted secret file, not stored in the source tree.
    postgres_password_file: str = "/run/secrets/studio_postgres_password"
    redis_url: str = "redis://redis:6379/0"
    app_origin: str = "https://studio.librechat.online"
    cookie_name: str = "__Host-studio_session"
    cookie_secure: bool = True
    session_days: int = 14
    session_last_seen_write_interval_seconds: int = Field(default=300, ge=60, le=3600)
    auth_cleanup_interval_seconds: int = Field(default=3600, ge=60, le=86400)
    auth_cleanup_batch_size: int = Field(default=500, ge=1, le=1000)
    credential_master_key_file: str = "/run/secrets/studio_credential_master_key"
    credential_key_id: str = "studio-v1"
    enable_api_docs: bool = False
    trusted_proxy_ip: IPvAnyAddress = IPvAnyAddress("127.0.0.1")
    source_s3_endpoint_url: str | None = None
    source_s3_region: str = "auto"
    source_s3_bucket: str | None = None
    source_s3_access_key_id_file: str | None = None
    source_s3_secret_access_key_file: str | None = None
    source_upload_ttl_seconds: int = Field(default=3600, ge=900, le=86400)
    source_presign_ttl_seconds: int = Field(default=900, ge=60, le=900)
    source_max_upload_bytes: int = Field(default=536870912, ge=1, le=2147483647)
    audio_preparation_max_output_bytes: int = Field(default=2147483647, ge=1, le=2147483647)
    google_oauth_client_id: str | None = None
    google_oauth_client_secret_file: str | None = None
    google_oauth_redirect_uri: str | None = None
    google_oauth_scopes: str = (
        "openid email "
        "https://www.googleapis.com/auth/drive.file "
        "https://www.googleapis.com/auth/drive.readonly"
    )
    google_oauth_state_ttl_seconds: int = 600
    google_maintenance_oauth_client_id: str | None = None
    google_maintenance_oauth_client_secret_file: str | None = None
    google_maintenance_oauth_redirect_uri: str | None = None
    google_maintenance_oauth_scopes: str = (
        "openid email "
        "https://www.googleapis.com/auth/drive.metadata.readonly "
        "https://www.googleapis.com/auth/documents"
    )
    google_picker_api_key: str | None = None
    google_picker_app_id: str | None = None
    worker_poll_interval_seconds: int = Field(default=5, ge=1, le=60)
    worker_error_backoff_seconds: int = Field(default=5, ge=1, le=300)
    worker_lease_ttl_seconds: int = Field(default=3600, ge=300, le=86400)
    worker_lease_heartbeat_interval_seconds: int = Field(default=60, ge=5)
    provider_part_checkpoint_ttl_seconds: int = Field(default=86400, ge=3600, le=86400)
    realtime_draft_ttl_seconds: int = Field(default=259200, ge=259200, le=259200)
    diagnostic_retention_days: int = Field(default=14, ge=1, le=30)
    diagnostic_debug_retention_hours: int = Field(default=24, ge=1, le=24)
    diagnostic_cleanup_interval_seconds: int = Field(default=3600, ge=60, le=86400)
    diagnostic_cleanup_batch_size: int = Field(default=500, ge=1, le=1000)
    runtime_component: str = Field(default="unknown", max_length=20)
    runtime_release_version: str = Field(default="unknown", max_length=120)
    runtime_commit_sha: str = Field(default="unknown", max_length=40)
    runtime_build_id: str = Field(default="unknown", max_length=120)
    runtime_worker_heartbeat_interval_seconds: int = Field(default=30, ge=5, le=300)
    runtime_worker_stale_after_seconds: int = Field(default=120, ge=30, le=900)
    diagnostic_report_max_events: int = Field(default=5000, ge=1, le=5000)

    @field_validator("trusted_proxy_ip")
    @classmethod
    def validate_trusted_proxy_ip(cls, value: IPvAnyAddress):
        if value.is_unspecified or value.is_multicast:
            raise ValueError("trusted proxy must be one specific unicast IP")
        return value

    @model_validator(mode="after")
    def validate_worker_lease_heartbeat(self):
        if self.worker_lease_heartbeat_interval_seconds * 3 > self.worker_lease_ttl_seconds:
            raise ValueError("worker lease heartbeat interval must be at most one third of worker lease ttl")
        if self.runtime_worker_heartbeat_interval_seconds * 2 > self.runtime_worker_stale_after_seconds:
            raise ValueError("runtime worker stale threshold must cover at least two heartbeat intervals")
        return self

    def master_key_b64(self) -> str:
        return Path(self.credential_master_key_file).read_text(encoding="utf-8").strip()

    def postgres_password(self) -> str:
        return Path(self.postgres_password_file).read_text(encoding="utf-8").strip()

    def source_storage_configured(self) -> bool:
        return bool(
            self.source_s3_endpoint_url
            and self.source_s3_bucket
            and self.source_s3_access_key_id_file
            and self.source_s3_secret_access_key_file
        )

    def google_picker_configured(self) -> bool:
        return bool((self.google_picker_api_key or "").strip() and (self.google_picker_app_id or "").strip())

    def sqlalchemy_url(self) -> str:
        if self.database_url:
            return self.database_url
        password = quote_plus(self.postgres_password())
        user = quote_plus(self.database_user)
        name = quote_plus(self.database_name)
        return f"{self.database_scheme}://{user}:{password}@{self.database_host}:{self.database_port}/{name}"

@lru_cache
def get_settings() -> Settings:
    return Settings()
