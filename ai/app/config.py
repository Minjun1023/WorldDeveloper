"""환경 변수 + 설정."""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # 서비스
    service_name: str = "dev-jobs-ai"
    port: int = 8001
    internal_auth_token: str = "dev-local-token"

    # 요약/프로필 파싱 (OpenAI). .env 또는 OPENAI_API_KEY 환경변수. 미설정 시 해당 기능 비활성.
    openai_api_key: str = ""
    # OpenAI 호출 모델. 코드 상수 대신 env(OPENAI_MODEL)로 교체 가능 — 모델 A/B·업그레이드용.
    openai_model: str = "gpt-4o-mini"

    # 번역 (LibreTranslate 셀프호스팅). 외부 API/키 불필요 — 로컬 컨테이너 호출.
    # dev.sh(docker compose)가 5050 포트로 띄움. URL 을 빈 값으로 두면 번역 비활성(503).
    libretranslate_url: str = "http://localhost:5050"
    libretranslate_api_key: str = ""  # LibreTranslate 에 api-keys 설정한 경우만(로컬 기본 불필요)

    # 임베딩 모델
    embedding_model: str = "paraphrase-multilingual-MiniLM-L12-v2"
    embedding_dim: int = 384
    # 비자 토큰 태깅 모델 (HF Hub id, 예: "youruser/worlddev-visa-tagger").
    # 미설정 시 로컬 비자 분류 비활성 → 키워드/명부/OpenAI폴백/회사추론으로 동작.
    visa_tagger_model: str = ""
    visa_tagger_min_confidence: float = 0.5

    # Postgres
    database_url: str = "postgresql://devjobs:devjobs_local@localhost:5433/devjobs"

    # ETL
    etl_enabled: bool = False  # MVP skeleton 에서는 비활성
    # 수집 스케줄: 매일 고정 시각(cron). 기본 = 매일 00:00(자정). 변경하려면 ETL_CRON 환경변수.
    # 시각 기준 타임존(ETL_TIMEZONE). 기본 한국 자정(Asia/Seoul). 컨테이너 TZ 와 무관하게 해당 TZ 자정에 실행.
    etl_cron: str = "0 0 * * *"
    etl_timezone: str = "Asia/Seoul"
    # 워커(app.etl.worker) 부팅 시 1회 즉시 수집 여부. 기본 off — 재시작마다 전량 재수집되지 않도록.
    # 새 환경 부트스트랩용: ETL_RUN_ON_START=1 로 켜면 첫 자정을 기다리지 않고 바로 채운다.
    etl_run_on_start: bool = False
    # 정기/수동 ETL 사이클에서 비자 LLM 재분류(OpenAI 호출)를 할지. 기본 off = 무비용.
    # 수집·정리(전부 로컬)와 유료 LLM 단계를 분리 — 재분류는 /etl/reclassify-visa 로 옵트인.
    etl_reclassify: bool = False
    # 공고 비활성화 정책
    stale_days: int = 7          # 소스 피드에서 N일 미관측 시 비활성화(잘림/실패 범위용 fallback)
    job_max_age_days: int = 180  # 마감일 없는 공고: 게시 N일 후 자동 만료(보수적 안전망)
    # 성공+완전(미캡) 수집된 범위는 다음 사이클에 즉시 정리(7일 유예 생략). 일시 실패/잘린
    # 범위는 제외돼 깜빡임 없음. off 면 기존 stale_days 시간기반만 동작.
    etl_prune_unseen: bool = True

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
