"""기존 활성 공고에 relocation_support / language_requirement 정규식 백필 (LLM 미사용, 멱등).

사용: DATABASE_URL=... uv run python -m app.etl.backfill_job_meta_regex
"""
from __future__ import annotations

import os

import psycopg

from dev_jobs_core.analyzers.job_meta import extract_language, extract_relocation

DSN = os.environ.get("DATABASE_URL", "postgresql://devjobs:devjobs@localhost:5432/devjobs")


def main() -> None:
    relo_n = lang_n = 0
    with psycopg.connect(DSN) as conn:
        rows = conn.execute(
            "SELECT id, description_text FROM jobs WHERE is_active = true AND description_text IS NOT NULL"
        ).fetchall()
        for i, (jid, text) in enumerate(rows, 1):
            relo = extract_relocation(text)
            lang = extract_language(text)
            if relo is None and lang is None:
                continue
            conn.execute(
                "UPDATE jobs SET relocation_support = %s, language_requirement = %s WHERE id = %s",
                (relo, lang, jid),
            )
            if relo is not None:
                relo_n += 1
            if lang is not None:
                lang_n += 1
            if i % 500 == 0:
                conn.commit()
        conn.commit()
    print(f"완료: {len(rows)}건 중 relocation {relo_n}건, language {lang_n}건 채움")


if __name__ == "__main__":
    main()
