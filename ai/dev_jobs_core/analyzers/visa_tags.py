"""비자 토큰 태깅 — BIO 스킴 + 스팬→상태 도출 (순수 로직, 모델 비의존)."""
from __future__ import annotations

import re
from dataclasses import dataclass

# BIO 5태그. 학습/추론 양쪽이 공유하는 단일 출처.
LABELS = ["O", "B-VISA_POS", "I-VISA_POS", "B-VISA_NEG", "I-VISA_NEG"]
LABEL2ID = {label: i for i, label in enumerate(LABELS)}
ID2LABEL = {i: label for i, label in enumerate(LABELS)}


@dataclass
class Span:
    label: str  # "VISA_POS" | "VISA_NEG"
    text: str
    score: float


def spans_to_status(spans: list[Span]) -> tuple[str, list[str]]:
    """태깅된 스팬으로 비자 상태와 근거를 결정한다.

    POS 우선(스폰서십 필요한 사용자에게 actionable), 동률은 신뢰도 높은 스팬.
    스팬이 곧 근거이므로 grounding 이 내장된다.
    """
    pos = [s for s in spans if s.label == "VISA_POS"]
    if pos:
        best = max(pos, key=lambda s: s.score)
        return "sponsors", [best.text]
    neg = [s for s in spans if s.label == "VISA_NEG"]
    if neg:
        best = max(neg, key=lambda s: s.score)
        return "no_sponsor", [best.text]
    return "unclear", []


def find_evidence_span(text: str, quote: str) -> tuple[int, int] | None:
    """본문에서 근거 문구의 char 오프셋 (start, end) 를 찾는다. 공백/대소문자 무시.

    약라벨 생성용 — LLM/키워드 근거 문구를 본문 원문 위치에 매핑한다. 못 찾으면 None.
    """
    q = re.sub(r"\s+", " ", (quote or "").strip()).lower()
    if len(q) < 6:
        return None
    # 본문을 정규화하되, 정규화 인덱스 → 원문 인덱스 매핑을 유지한다.
    norm_chars: list[str] = []
    norm_to_orig: list[int] = []
    prev_space = False
    for i, ch in enumerate(text):
        if ch.isspace():
            if prev_space:
                continue
            norm_chars.append(" ")
            norm_to_orig.append(i)
            prev_space = True
        else:
            norm_chars.append(ch.lower())
            norm_to_orig.append(i)
            prev_space = False
    norm = "".join(norm_chars)
    idx = norm.find(q)
    if idx < 0:
        return None
    start = norm_to_orig[idx]
    end = norm_to_orig[idx + len(q) - 1] + 1
    return start, end
