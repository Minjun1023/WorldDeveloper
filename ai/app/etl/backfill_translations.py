"""활성 공고 중 한국어 번역이 없는 것을 미리 번역해 job_translations 캐시를 채운다(멱등).

조회 시 즉시 표시(로딩/503 방지)되도록 ETL 사이클 끝(jobs.run_full_cycle)과 수동 실행에서 호출한다.
이미 번역(job_translations 행 존재)된 공고는 건너뛴다.
사용: cd ai && uv run python -m app.etl.backfill_translations
"""
from __future__ import annotations

import asyncio
import logging
import os

import psycopg

from ..translate_engine import TranslationUnavailable, translate_pair

log = logging.getLogger(__name__)

DSN = os.environ.get("DATABASE_URL", "postgresql://devjobs:devjobs@localhost:5432/devjobs")
LANG = "ko"
_COMMIT_EVERY = 25  # 중간 커밋 — 긴 백필 중 일부라도 보존


async def backfill_translations(limit: int | None = None) -> dict[str, int]:
    """미번역 활성 공고를 번역해 job_translations 에 INSERT. 반환 통계."""
    translated = 0
    failed = 0
    candidates = 0
    with psycopg.connect(DSN) as conn:
        sql = (
            "SELECT j.id, j.title, COALESCE(j.description, j.description_text, '') "
            "FROM jobs j "
            "WHERE j.is_active = true "
            "  AND NOT EXISTS (SELECT 1 FROM job_translations t "
            "                  WHERE t.job_id = j.id AND t.lang = %s) "
            "ORDER BY j.posted_at DESC NULLS LAST"
        )
        params: tuple = (LANG,)
        if limit:
            sql += " LIMIT %s"
            params = (LANG, limit)
        rows = conn.execute(sql, params).fetchall()
        candidates = len(rows)

        for jid, title, desc in rows:
            if not title and not desc:
                continue
            try:
                t_title, t_desc, engine = await translate_pair(title or "", desc or "", LANG)
            except TranslationUnavailable:
                log.warning("LIBRETRANSLATE_URL 미설정 — 번역 백필 중단")
                break
            except Exception as e:  # noqa: BLE001 — 한 공고 실패가 전체를 막지 않도록
                log.warning("번역 실패 %s: %s", jid, e)
                failed += 1
                continue
            conn.execute(
                "INSERT INTO job_translations (job_id, lang, title, description, engine) "
                "VALUES (%s, %s, %s, %s, %s) ON CONFLICT (job_id, lang) DO NOTHING",
                (jid, LANG, t_title, t_desc, engine),
            )
            translated += 1
            if translated % _COMMIT_EVERY == 0:
                conn.commit()
                log.info("번역 진행: %s/%s", translated, candidates)
        conn.commit()

    log.info("번역 백필 완료: translated=%s failed=%s candidates=%s", translated, failed, candidates)
    return {"translated": translated, "failed": failed, "candidates": candidates}


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    asyncio.run(backfill_translations())


if __name__ == "__main__":
    main()
