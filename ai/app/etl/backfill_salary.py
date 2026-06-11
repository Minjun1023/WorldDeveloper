"""기존 활성 공고 description 에서 연봉을 1회 추출해 채운다(멱등: salary_currency NULL 만).

원본 통화/금액/기간(salary_min/max/currency/period) + USD 환산(salary_min_usd/max_usd, 비어있을 때만).
사용: cd ai && uv run python -m app.etl.backfill_salary
"""
from __future__ import annotations

import os

import psycopg

from dev_jobs_core.analyzers.salary import _to_usd_year, extract_salary_from_description

DSN = os.environ.get("DATABASE_URL", "postgresql://devjobs:devjobs@localhost:5432/devjobs")


def main() -> None:
    filled = 0
    with psycopg.connect(DSN) as conn:
        rows = conn.execute(
            "SELECT id, description FROM jobs "
            "WHERE is_active = true AND salary_currency IS NULL AND description IS NOT NULL"
        ).fetchall()
        for jid, desc in rows:
            ext = extract_salary_from_description(desc)
            if not ext:
                continue
            usd = _to_usd_year(ext["min"], ext["currency"], ext["period"])
            usd_max = _to_usd_year(ext["max"], ext["currency"], ext["period"])
            conn.execute(
                "UPDATE jobs SET salary_min=%s, salary_max=%s, salary_currency=%s, salary_period=%s, "
                "salary_min_usd=COALESCE(salary_min_usd,%s), salary_max_usd=COALESCE(salary_max_usd,%s) "
                "WHERE id=%s",
                (ext["min"], ext["max"], ext["currency"], ext["period"],
                 int(usd) if usd else None, int(usd_max) if usd_max else None, jid),
            )
            filled += 1
        conn.commit()
    print(f"backfilled salary for {filled} / {len(rows)} active jobs")


if __name__ == "__main__":
    main()
