"""공고 본문에서 요구 경력(최소 연차) 추출.

해외 개발자 JD 에 흔한 'N+ years' / 'N-M years' / 'N years of experience' /
'at least N years' 패턴을 정규식으로 잡는다. 명확한 매치만(추정 금지).
여러 매치면 가장 작은 값(요구 최소)을 쓴다. 단어경계로 100 같은 큰 수 오탐 방지.
"""
from __future__ import annotations

import re

_PATTERNS = [
    re.compile(r"\b(\d{1,2})\s*\+\s*years?", re.I),
    re.compile(r"\b(\d{1,2})\s*(?:[-–]|to)\s*\d{1,2}\s*years?", re.I),
    re.compile(r"\b(\d{1,2})\s*years?\s+(?:of\s+)?(?:experience|exp\b)", re.I),
    re.compile(r"(?:at least|minimum(?:\s+of)?|min\.?)\s+(\d{1,2})\s*years?", re.I),
]


def extract_experience_years(text: str) -> int | None:
    """본문에서 요구 최소 경력(년). 명확한 매치 없으면 None. 0~40 범위만."""
    if not text:
        return None
    found: list[int] = []
    for pat in _PATTERNS:
        for m in pat.finditer(text):
            n = int(m.group(1))
            if 0 <= n <= 40:
                found.append(n)
    return min(found) if found else None
