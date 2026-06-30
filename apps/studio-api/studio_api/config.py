from functools import lru_cache
from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="STUDIO_", env_file=".env", extra="ignore")
    environment: str = "production"
    database_url: str = "sqlite+pysqlite:///./studio_api.db"
    redis_url: str = "redis://redis:6379/0"
    app_origin: str = "https://studio.librechat.online"
    cookie_name: str = "__Host-studio_session"
    cookie_secure: bool = True
    session_days: int = 14
    credential_master_key_file: str = "/run/secrets/studio_credential_master_key"
    credential_key_id: str = "studio-v1"
    enable_api_docs: bool = False
    trusted_proxy_ip: str = "127.0.0.1"

    def master_key_b64(self) -> str:
        return Path(self.credential_master_key_file).read_text(encoding="utf-8").strip()

@lru_cache
def get_settings() -> Settings:
    return Settings()
