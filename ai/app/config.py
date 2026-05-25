"""환경 변수 + 설정."""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # 서비스
    service_name: str = "dev-jobs-ai"
    port: int = 8001
    internal_auth_token: str = "dev-local-token"

    # 번역 (OpenAI). .env 또는 OPENAI_API_KEY 환경변수로 주입. 미설정 시 번역 비활성.
    openai_api_key: str = ""

    # 임베딩 모델
    embedding_model: str = "paraphrase-multilingual-MiniLM-L12-v2"
    embedding_dim: int = 384

    # Postgres
    database_url: str = "postgresql://devjobs:devjobs_local@localhost:5433/devjobs"

    # ETL
    etl_enabled: bool = False  # MVP skeleton 에서는 비활성
    etl_interval_minutes: int = 60
    # 공고 비활성화 정책
    stale_days: int = 7          # 소스 피드에서 N일 미관측 시 비활성화
    job_max_age_days: int = 180  # 마감일 없는 공고: 게시 N일 후 자동 만료(보수적 안전망)

    # Adzuna (무료 집계 소스). ADZUNA_APP_ID/KEY 없으면 비활성(다른 소스는 정상).
    adzuna_app_id: str = ""
    adzuna_app_key: str = ""
    adzuna_countries: str = "us,gb,de,nl,ca,fr,ie,au,sg"
    adzuna_per_country: int = 50
    adzuna_max_pages: int = 1

    @property
    def adzuna_countries_list(self) -> list[str]:
        return [c.strip() for c in self.adzuna_countries.split(",") if c.strip()]


settings = Settings()
