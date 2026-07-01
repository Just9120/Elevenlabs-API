from functools import lru_cache
from pathlib import Path
from urllib.parse import quote_plus
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
    credential_master_key_file: str = "/run/secrets/studio_credential_master_key"
    credential_key_id: str = "studio-v1"
    enable_api_docs: bool = False
    trusted_proxy_ip: str = "127.0.0.1"
    source_s3_endpoint_url: str | None = None
    source_s3_region: str = "auto"
    source_s3_bucket: str | None = None
    source_s3_access_key_id_file: str | None = None
    source_s3_secret_access_key_file: str | None = None
    source_upload_ttl_seconds: int = 3600
    source_presign_ttl_seconds: int = 900
    source_max_upload_bytes: int = 536870912

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
