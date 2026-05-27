"""개발 직무 필터. 집계/보드 소스의 비개발 공고를 제거한다.

스펙 §B-1: 제외 키워드가 title 에 있으면 drop, 아니면 keep(재현율 우선).
"""
from __future__ import annotations

# title 에 포함되면 비개발로 보고 drop.
# 부분일치(substring)이므로 진짜 개발 직함을 떨어뜨리지 않게 "구"단위로 둔다.
# (bare "manager" 금지 → "engineering manager" 유지; "growth" 금지 → "growth engineer" 유지)
_DENY = (
    # 영업/마케팅/BD ("account exec" 은 Exec/Executive 약어 모두 포함)
    "sales", "account exec", "account manager", "marketing", "social media",
    "business development", "partnership", "community manager", "growth manager",
    # 채용/HR/총무 ("recruit" 은 recruiter/recruiting/recruitment 모두 포함)
    "recruit", "talent acquisition", "human resources",
    "people operations", "office manager", "operations manager",
    "executive assistant", "administrative",
    # CS/온보딩/구현(비엔지니어)
    "customer success", "customer support", "onboarding specialist",
    "implementation specialist", "implementation consultant", "virtual assistant",
    # 법무/재무
    "counsel", "legal", "finance", "accountant", "bookkeeper",
    # 기획/PM/디자인/콘텐츠
    "product manager", "product owner", "program manager", "project manager",
    "designer", "content writer", "copywriter",
)


def is_dev_role(title: str, tags: list[str] | None = None, description: str = "") -> bool:
    t = (title or "").lower()
    for d in _DENY:
        if d in t:
            return False
    # 제외 키워드 없음 → 개발 공고로 간주(재현율 우선). tags/description 은
    # 향후 정밀 필터 확장 여지로 시그니처에만 둔다.
    return True
