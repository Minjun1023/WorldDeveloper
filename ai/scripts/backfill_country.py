"""활성 공고의 country(ISO2)·city(slug)를 location 에서 1회 채운다(멱등).

지역 필터/드롭다운을 데이터 파생(GROUP BY country/city)으로 전환하기 위한 backfill.
컬럼이 없으면 생성(마이그레이션 V30/V31 과 동일, IF NOT EXISTS).
사용: cd ai && DATABASE_URL=... uv run python -m scripts.backfill_country [--all]
  --all: 이미 채워진 것도 재계산(리졸버 개선 후 재적용용). 기본은 country IS NULL 만.
"""
from __future__ import annotations

import argparse
import os

import psycopg

from dev_jobs_core.geo import detect_city, detect_country

DSN = os.environ.get("DATABASE_URL", "postgresql://devjobs:devjobs@localhost:5432/devjobs")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true", help="이미 채워진 것도 재계산")
    args = ap.parse_args()

    with psycopg.connect(DSN) as conn:
        conn.execute("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS country TEXT")
        conn.execute("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS city TEXT")
        conn.commit()
        where = "is_active = true" if args.all else "is_active = true AND country IS NULL AND city IS NULL"
        rows = conn.execute(f"SELECT id, location FROM jobs WHERE {where}").fetchall()

        got_country = got_city = 0
        for i, (jid, loc) in enumerate(rows, 1):
            country = detect_country(loc)
            city = detect_city(loc)
            conn.execute(
                "UPDATE jobs SET country = %s, city = %s WHERE id = %s", (country, city, jid)
            )
            got_country += country is not None
            got_city += city is not None
            if i % 500 == 0:
                conn.commit()
        conn.commit()
    print(f"{len(rows)}건 처리: country {got_country}, city {got_city}")


if __name__ == "__main__":
    main()
