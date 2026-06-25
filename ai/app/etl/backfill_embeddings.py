"""활성 공고의 embedding 을 새 텍스트 구성(제목+스택 앞세움)으로 1회 재계산한다.

의미 유사도가 회사 소개 보일러플레이트가 아니라 역할/도메인/스택을 반영하도록
build_embed_text 로 다시 임베딩한다. 멱등(여러 번 돌려도 같은 결과).
사용: cd ai && uv run python -m app.etl.backfill_embeddings [--limit N]
"""
from __future__ import annotations

import argparse
import os

import psycopg
from pgvector.psycopg import register_vector

from dev_jobs_core.recommender.embeddings import build_embed_text, embed_text

DSN = os.environ.get("DATABASE_URL", "postgresql://devjobs:devjobs@localhost:5432/devjobs")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None, help="처리할 공고 수 제한(테스트용)")
    args = ap.parse_args()

    updated = 0
    skipped = 0
    with psycopg.connect(DSN) as conn:
        register_vector(conn)
        sql = "SELECT id, title, tags, description_text FROM jobs WHERE is_active = true"
        if args.limit:
            sql += f" LIMIT {int(args.limit)}"
        rows = conn.execute(sql).fetchall()
        for i, (jid, title, tags, plain) in enumerate(rows, 1):
            vec = embed_text(build_embed_text(title, tags, plain))
            if vec is None:
                skipped += 1
                continue
            conn.execute("UPDATE jobs SET embedding = %s WHERE id = %s", (vec, jid))
            updated += 1
            if i % 200 == 0:
                conn.commit()
                print(f"  ... {i}/{len(rows)}", flush=True)
        conn.commit()
    print(f"re-embedded {updated} / {len(rows)} active jobs (skipped {skipped})")


if __name__ == "__main__":
    main()
