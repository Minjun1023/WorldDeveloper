"""ETL cron 잡 정의.

MVP skeleton 단계에서는 stub. 실제 구현은 W2 (DESIGN.md 로드맵):
  1. dev_jobs_core.sources.* fetch (병렬)
  2. analyzers.visa 분류
  3. analyzers.salary USD 정규화
  4. recommender.embeddings 로 vector 계산
  5. Postgres UPSERT (psycopg)
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

log = logging.getLogger(__name__)


async def run_full_cycle_stub() -> dict:
    """ETL 한 사이클 stub. 실제 로직은 W2 에서 채움."""
    log.info("ETL cycle stub invoked")
    return {
        "started_at": datetime.now(timezone.utc).isoformat(),
        "phases": [
            {"phase": "fetch", "status": "stub"},
            {"phase": "classify_visa", "status": "stub"},
            {"phase": "normalize_salary", "status": "stub"},
            {"phase": "embed", "status": "stub"},
            {"phase": "upsert", "status": "stub"},
        ],
        "note": "MVP skeleton — 실제 ETL 은 Week 2 에서 dev_jobs_core 와 연결",
    }
