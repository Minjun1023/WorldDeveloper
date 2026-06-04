"""DB 라벨 → 비자 토큰태깅 학습 데이터셋(JSONL). 약(silver) 라벨.

각 줄: {"text": <description>, "spans": [{"start","end","label"}]}
- sponsors/no_sponsor + visa_evidence 가 본문에 verbatim 으로 있으면 → 그 스팬을 양성으로.
- 근거가 명부/회사추론 마커(본문에 없음)면 → 제외(환각 유발 방지).
- unclear → 빈 스팬(음성). 다수이므로 --neg-ratio 로 다운샘플.
사용: cd ai && uv run python scripts/export_visa_dataset.py --out data/visa_dataset.jsonl
"""
from __future__ import annotations

import argparse
import json
import random

import psycopg

from app.config import settings
from dev_jobs_core.analyzers.visa_tags import find_evidence_span

# 본문에 근거 문구가 없는(명부/회사추론) 양성 — 스팬 학습에서 제외할 마커.
NON_TEXT_MARKERS = ("명부", "Home Office", "USCIS", "IND", "같은 회사", "Employer Data")


def _label_for(status: str) -> str | None:
    if status == "sponsors":
        return "VISA_POS"
    if status == "no_sponsor":
        return "VISA_NEG"
    return None


def build_rows(jobs: list[dict], neg_ratio: float, seed: int = 0) -> list[dict]:
    rng = random.Random(seed)
    pos_rows: list[dict] = []
    neg_pool: list[dict] = []
    for j in jobs:
        text = j["description_text"] or ""
        if len(text) < 20:
            continue
        status = j["visa_status"]
        evidence = j["visa_evidence"] or []
        if status == "unclear":
            neg_pool.append({"text": text, "spans": []})
            continue
        label = _label_for(status)
        if label is None:
            continue
        spans = []
        for quote in evidence:
            if any(m in quote for m in NON_TEXT_MARKERS):
                continue  # 명부/회사추론 — 본문 근거 아님
            found = find_evidence_span(text, quote)
            if found:
                spans.append({"start": found[0], "end": found[1], "label": label})
        if spans:
            pos_rows.append({"text": text, "spans": spans})
        # 양성인데 본문 스팬을 못 찾으면 학습서 제외(라벨 노이즈 방지)
    # 음성 다운샘플: 양성 수 * neg_ratio
    n_neg = min(len(neg_pool), int(len(pos_rows) * neg_ratio))
    neg_rows = rng.sample(neg_pool, n_neg) if n_neg > 0 else []
    rows = pos_rows + neg_rows
    rng.shuffle(rows)
    return rows


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data/visa_dataset.jsonl")
    ap.add_argument("--neg-ratio", type=float, default=2.0)
    ap.add_argument("--limit", type=int, default=None)
    args = ap.parse_args()

    with psycopg.connect(settings.database_url) as conn:
        sql = (
            "SELECT id, title, description_text, visa_status, visa_evidence "
            "FROM jobs WHERE is_active = true AND description_text IS NOT NULL"
        )
        if args.limit:
            sql += f" LIMIT {int(args.limit)}"
        rows_db = conn.execute(sql).fetchall()
    jobs = [
        {"id": r[0], "title": r[1], "description_text": r[2], "visa_status": r[3], "visa_evidence": r[4]}
        for r in rows_db
    ]
    rows = build_rows(jobs, args.neg_ratio)

    import os

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    n_pos = sum(1 for r in rows if r["spans"])
    print(f"wrote {len(rows)} rows ({n_pos} with spans, {len(rows) - n_pos} negatives) -> {args.out}")


if __name__ == "__main__":
    main()
