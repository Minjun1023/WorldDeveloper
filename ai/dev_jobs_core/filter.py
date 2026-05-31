"""개발 직무 필터 (정밀도 우선 / allowlist).

기존 recall-first deny-list 는 대형 ATS 의 다양한 비개발 직무(회계·통신·세무·
고객상담 등)를 막지 못해 라이브에서 누수가 ~50% 였다. "개발 신호가 있는
제목만 keep" 으로 전환.

판정 순서:
  1) 강한 개발 신호(software/developer/devops/data scientist 등) → keep
     (팀명에 'Solutions Engineering' 이 붙은 진짜 SWE 까지 보호)
  2) 명백 비개발 / 비SW 엔지니어(solutions engineer·mechanical engineer 등) → drop
  3) generic 'engineer'/'engineering'/'architect' → keep (1·2 에 안 걸린 'X Engineer')
  4) 그 외 → drop (개발 신호 없음)
"""
from __future__ import annotations

# 1) 강한 개발 신호 — 있으면 무조건 keep ('engineer' 단어가 없는 개발직 보호)
_STRONG = (
    "software", "developer", "développeur", "desenvolvedor", "entwickler",
    "programmer", "programmier", "back-end", "backend", "back end",
    "front-end", "frontend", "front end", "full-stack", "full stack", "fullstack",
    "devops", "dev ops", "sre", "site reliability", "data engineer",
    "data scientist", "research scientist", "machine learning", "ml engineer",
    "mlops", "ai engineer", "ai/ml", "ml/ai", "platform engineer",
    "infrastructure engineer", "security engineer", "qa engineer", "sdet",
    "test automation", "embedded", "firmware", "blockchain", "smart contract",
    "database administrator", "cloud engineer", "android",
    "tech lead", "technical lead", "engineering lead",
    "technical staff", "applied scientist", "applied ml", "research engineer",
)

# 2) hard-deny: 비SW 엔지니어/명백 비개발 — generic 'engineer' 통과보다 먼저 drop.
#    (analyst/consultant/strategy/compliance 등 'soft' 비개발은 여기 넣지 않는다 —
#     개발 신호 없으면 4)에서 어차피 drop 되고, 'Security/Compliance Engineer' 같은
#     진짜 엔지니어를 살리기 위함)
_DENY = (
    # 영업/마케팅/BD + 프리세일즈 엔지니어
    "sales", "account exec", "account manager", "marketing", "social media",
    "business development", "partnership", "community manager", "growth manager",
    "solution engineer", "solutions engineer", "solution engineering",
    "solutions engineering", "sales engineer", "presales", "pre-sales",
    "technical account", "strategist",
    # 프리세일즈/전문서비스 아키텍트 — #34: 라이브 누수 대부분(Partner/Delivery/
    # Customer/Public Sector Solutions Architect). 'software/cloud/data architect'·
    # generic 'architect' 는 STRONG/rule3 로 살아남음(solution(s) 한정 deny).
    "solution architect", "solutions architect",
    # 비SW 엔지니어 — #34: rule3(generic engineer)로 새던 지원/밸류/고객/네트워크 직
    "support engineer", "support engineering", "value engineer", "value engineering",
    "customer engineer", "customer engineering", "network engineer",
    "network engineering", "implementation engineer",
    # 비SW 엔지니어(하드웨어/설비/제조)
    "mechanical engineer", "electrical engineer", "civil engineer",
    "chemical engineer", "industrial engineer", "biomedical", "hardware engineer",
    "manufactur", "field engineer", "facilities", "data center", "process engineer",
    # 채용/HR/총무
    "recruit", "talent acquisition", "human resources", "people operations",
    "office manager", "operations manager", "executive assistant", "administrative",
    # CS/온보딩/구현
    "customer success", "customer support", "onboarding specialist",
    "implementation specialist", "implementation consultant", "virtual assistant",
    "customer advisor", "kundenberater",
    # 법무/재무/회계
    "counsel", "legal", "finance", "accountant", "accounting", "accounts payable",
    "accounts receivable", "bookkeeper", "buchhalter", "fp&a", "tax ", "treasury",
    "procurement", "sourcing",
    # 기획/PM/디자인/콘텐츠/커뮤니케이션
    "product manager", "product owner", "program manager", "project manager",
    "designer", "content writer", "copywriter", "copy lead", "communications",
    "creative", "editor", "brand ",
)


def is_dev_role(title: str, tags: list[str] | None = None, description: str = "") -> bool:
    t = (title or "").lower()
    # 1) 강한 개발 신호 → keep (deny 보다 우선: 'Software Engineer, Solutions Eng' 보호)
    if any(s in t for s in _STRONG):
        return True
    # 2) 비개발/비SW 엔지니어 → drop
    if any(d in t for d in _DENY):
        return False
    # 3) generic engineer/architect → keep
    if "engineer" in t or "engineering" in t or "architect" in t:
        return True
    # 4) 개발 신호 없음 → drop (precision-first)
    return False
