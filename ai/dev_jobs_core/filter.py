"""개발 직무 필터. 집계/보드 소스의 비개발 공고를 제거한다.

스펙 §B-1: 제외 키워드가 title 에 있으면 drop, 아니면 keep(재현율 우선).
"""
from __future__ import annotations

# title 에 포함되면 비개발로 보고 drop
_DENY = (
    "sales", "account executive", "marketing", "recruiter", "recruiting",
    "talent acquisition", "customer success", "customer support",
    "account manager", "finance", "accountant", "human resources",
    "designer", "product manager", "product owner", "content writer",
    "copywriter", "social media", "business development", "office manager",
)


def is_dev_role(title: str, tags: list[str] | None = None, description: str = "") -> bool:
    t = (title or "").lower()
    for d in _DENY:
        if d in t:
            return False
    # 제외 키워드 없음 → 개발 공고로 간주(재현율 우선). tags/description 은
    # 향후 정밀 필터 확장 여지로 시그니처에만 둔다.
    return True
