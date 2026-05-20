"""환경 변수 + 설정."""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # 서비스
    service_name: str = "dev-jobs-ai"
    port: int = 8001
    internal_auth_token: str = "dev-local-token"

    # 임베딩 모델
    embedding_model: str = "paraphrase-multilingual-MiniLM-L12-v2"
    embedding_dim: int = 384

    # Postgres
    database_url: str = "postgresql://devjobs:devjobs_local@localhost:5433/devjobs"

    # ETL
    etl_enabled: bool = False  # MVP skeleton 에서는 비활성
    etl_interval_minutes: int = 60


settings = Settings()
