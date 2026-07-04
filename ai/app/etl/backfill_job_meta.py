"""활성 공고 본문에서 relocation/어학/학위를 LLM 으로 추출.

샘플 검증:  DATABASE_URL=... uv run python -m app.etl.backfill_job_meta --sample 100
결과는 /tmp/job_meta_sample.json 에 저장 + 콘솔에 분포·예시를 출력한다.
(전체 백필 모드는 품질 승인 후 --all 로 실행 — DB 반영은 그때 붙인다.)
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import random

import httpx
import psycopg

from .job_meta_llm import extract_job_meta

DSN = os.environ.get("DATABASE_URL", "postgresql://devjobs:devjobs@localhost:5432/devjobs")
CONCURRENCY = 8


def fetch_sample(n: int) -> list[dict]:
    with psycopg.connect(DSN) as conn:
        rows = conn.execute(
            """
            SELECT id, title, description_text, country
            FROM jobs
            WHERE is_active = true AND description_text IS NOT NULL
            ORDER BY random() LIMIT %s
            """,
            (n,),
        ).fetchall()
    return [{"id": r[0], "title": r[1], "text": r[2], "country": r[3]} for r in rows]


async def run(jobs: list[dict]) -> list[dict]:
    sem = asyncio.Semaphore(CONCURRENCY)
    async with httpx.AsyncClient(timeout=60) as client:
        async def one(j: dict) -> dict:
            async with sem:
                meta = await extract_job_meta(j["title"], j["text"], client)
            return {**{k: j[k] for k in ("id", "title", "country")}, "meta": meta}
        return await asyncio.gather(*[one(j) for j in jobs])


def summarize(results: list[dict]) -> None:
    ok = [r for r in results if r["meta"]]
    print(f"\n추출 성공 {len(ok)}/{len(results)}건")
    for field in ("relocation", "language", "degree"):
        from collections import Counter
        dist = Counter(r["meta"][field] for r in ok)
        print(f"  {field}: {dict(dist.most_common(6))}")
    print("\n=== non-unclear 예시 (근거 인용 포함) ===")
    shown = 0
    random.shuffle(ok)
    for r in ok:
        m = r["meta"]
        interesting = [(f, m[f], m[f + '_quote']) for f in ("relocation", "language", "degree")
                       if m[f] != "unclear"]
        if not interesting or shown >= 8:
            continue
        shown += 1
        print(f"\n[{r['country']}] {r['title'][:60]}  ({r['id']})")
        for f, v, q in interesting:
            print(f"  {f} = {v}   근거: \"{q[:90]}\"")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sample", type=int, default=100)
    args = ap.parse_args()

    jobs = fetch_sample(args.sample)
    print(f"{len(jobs)}건 추출 시작 (모델 병렬 {CONCURRENCY})…")
    results = asyncio.run(run(jobs))

    out = "/tmp/job_meta_sample.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=1)
    print(f"저장: {out}")
    summarize(results)


if __name__ == "__main__":
    main()
