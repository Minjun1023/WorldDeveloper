"""공고 제목과 description 에서 시니어리티 레벨 추출."""
from __future__ import annotations
import re

# 명시적 시니어리티 키워드 (우선순위 순)
SENIORITY_PATTERNS = [
    ("principal", [r"\bprincipal\b", r"\bdistinguished\b", r"\bfellow\b"]),
    ("staff",     [r"\bstaff\b", r"\bsr\.?\s*staff\b"]),
    ("senior",    [r"\bsenior\b", r"\bsr\.?\b", r"\blead\b(?!\s+to)"]),  # "lead to" 는 제외
    ("mid",       [r"\bmid[-\s]?(?:level)?\b", r"\bintermediate\b", r"\bii\b"]),
    ("junior",    [r"\bjunior\b", r"\bjr\.?\b", r"\bentry[-\s]?level\b", r"\bnew\s+grad\b", r"\bgraduate\b", r"\bintern\b"]),
]

_COMPILED = [(level, [re.compile(p, re.IGNORECASE) for p in pats])
             for level, pats in SENIORITY_PATTERNS]


def detect_seniority(title: str, description: str = "") -> str:
    """제목 우선, 없으면 description 에서 시니어리티 추출.

    Returns: "principal" / "staff" / "senior" / "mid" / "junior" / "unspecified"
    """
    text = title or ""
    for level, patterns in _COMPILED:
        for pat in patterns:
            if pat.search(text):
                return level

    # 제목에 없으면 description 첫 500자에서만 (전체 보면 noise 많음)
    desc_head = (description or "")[:500]
    for level, patterns in _COMPILED:
        for pat in patterns:
            if pat.search(desc_head):
                return level

    return "unspecified"


# 시니어리티 순서값 (점수화에 사용)
SENIORITY_ORDER = {
    "junior": 1,
    "mid": 2,
    "senior": 3,
    "staff": 4,
    "principal": 5,
    "unspecified": 0,
}


def seniority_fit_score(user_level: str, job_level: str) -> float:
    """사용자 시니어리티와 공고 시니어리티 매칭 점수 (0~1).

    - 정확히 일치: 1.0
    - 한 단계 차이: 0.6 (도전적이거나 약간 낮음)
    - 두 단계 차이: 0.3
    - 더 멀거나 unspecified: 0.5 (중립)
    """
    u = SENIORITY_ORDER.get(user_level.lower(), 0)
    j = SENIORITY_ORDER.get(job_level.lower(), 0)
    if u == 0 or j == 0:
        return 0.5  # 정보 없음 → 중립
    diff = abs(u - j)
    return {0: 1.0, 1: 0.6, 2: 0.3}.get(diff, 0.1)
