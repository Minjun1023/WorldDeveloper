#!/usr/bin/env python3
"""unclear 공고 중 '비자 신호는 있는데 현재 분류기가 못 잡은' 표현을 발굴.

목적: 보수적 규칙 확장의 후보(고정밀로 추가 가능한 표현)를 데이터로 찾는다.
현재 classify_visa 가 unclear 로 판정하지만 description 에 비자 관련 키워드가
있는 공고를 모아, 키워드 주변 윈도우를 빈도순으로 출력한다.

실행: cd ai && uv run python scripts/mine_visa_unclear.py
"""
from __future__ import annotations

import re
from collections import Counter

import psycopg

from app.config import settings
from dev_jobs_core.analyzers.visa import classify_visa

# 비자/이주/취업권 관련 신호 키워드(넓게) — 이게 있는데 unclear 면 '놓친 후보'.
SIGNAL = re.compile(
    r"visa|sponsor|relocat|work\s+authoriz|work\s+permit|right\s+to\s+work|"
    r"eligible\s+to\s+work|authori[sz]ation\s+to\s+work|permit\s+to\s+work|"
    r"work\s+eligib|immigration|green\s+card|citizen",
    re.IGNORECASE,
)


def windows(text: str) -> list[str]:
    out = []
    for m in SIGNAL.finditer(text):
        s = max(0, m.start() - 45)
        e = min(len(text), m.end() + 45)
        w = re.sub(r"\s+", " ", text[s:e]).strip()
        out.append(w.lower())
    return out


def main() -> None:
    conn = psycopg.connect(settings.database_url)
    rows = conn.execute(
        "SELECT id, description_text FROM jobs "
        "WHERE is_active AND visa_status='unclear' "
        "AND description_text IS NOT NULL AND description_text <> ''"
    ).fetchall()
    conn.close()

    total = len(rows)
    missed = 0          # 신호 키워드가 있는데 unclear
    no_signal = 0       # 신호 자체가 없음(누구도 못 품)
    phrase_counter: Counter[str] = Counter()
    samples: list[str] = []

    for _id, desc in rows:
        if not SIGNAL.search(desc):
            no_signal += 1
            continue
        status, _ = classify_visa(desc)
        if status != "unclear":
            continue  # 현재 규칙이 이미 잡음(이론상 이미 재분류됐어야)
        missed += 1
        for w in windows(desc):
            # 윈도우를 핵심 구로 정규화: 신호 키워드 ±몇 단어
            phrase_counter[w] += 1
        if len(samples) < 40:
            for w in windows(desc)[:1]:
                samples.append(w)

    print(f"unclear total           : {total}")
    print(f"  신호 키워드 없음(불가) : {no_signal}  ({no_signal*100//max(total,1)}%)")
    print(f"  신호 있는데 unclear    : {missed}  ← 규칙 확장 후보")
    print()
    print("=== 놓친 윈도우 빈도 상위 60 (고빈도 = 규칙화 가치 큼) ===")
    for w, n in phrase_counter.most_common(60):
        print(f"{n:4}  {w}")


if __name__ == "__main__":
    main()
