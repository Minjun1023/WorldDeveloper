"""원격 공고의 한국 거주자 지원 가능 권역을 분류. analyzers/visa.py 미러.

분류 결과:
- worldwide         : 전 세계 원격 (한국 포함) → 지원 가능
- apac_ok           : APAC/아시아 광역 (한국 포함) → 지원 가능
- region_restricted : 특정 비-한국 권역 한정 (한국 제외) → 지원 불가
- unclear           : 원격이지만 권역 명시 없음 (worldwide 추정 금지 — 정직)
- None              : 원격 아님(온사이트)

주의: 키워드 매칭이라 100% 정확하지 않다. 모호하면 worldwide 가 아니라
unclear 로 둔다. 최종 노출 판단은 조회 계층(viable 게이트)이 한다.
"""
from __future__ import annotations

import re

# location 필드에 등장하면 비-한국 권역 한정으로 보는 토큰.
# (location 은 짧고 큐레이션된 필드라 권역명 자체가 한정 신호. description 본문엔 적용 안 함.)
_LOC_RESTRICT = [
    r"\bU\.?S\.?A?\b", r"\bUnited States\b", r"\bAmericas?\b", r"\bNorth America\b",
    r"\bLATAM\b", r"\bLatin America\b", r"\bEMEA\b", r"\bEU\b", r"\bEurope(?:an)?\b",
    r"\bU\.?K\.?\b", r"\bUnited Kingdom\b", r"\bCanada\b", r"\bAustralia\b", r"\bJapan\b",
]

# location/description 어디서든 명시적 lock-out 으로 보는 강한 한정 표현.
_STRONG_RESTRICT = [
    r"\bmust be (?:based|located) in\b",
    r"\b(?:authorized|eligible) to work in\b",
    r"\bresidents? of\b",
    r"\b(?:US|U\.S\.|USA|EU|UK|EMEA|Europe(?:an)?|Americas?|Canada|Australia)[-\s]?only\b",
    r"\b(?:US|U\.S\.|USA|EU|UK|EMEA|Europe(?:an)?)[-\s]?based\b",
    r"\boverlap with (?:US|U\.S\.|Europe|EST|PST|CET)\b",
    r"\b(?:PST|EST|CET) (?:time\s*zone|hours)\b",
    r"\b(?:US|European) time\s*zone\b",
]

# worldwide (한국 포함) 긍정 신호.
_WORLDWIDE = [
    r"\bworld[\s-]?wide\b", r"\bwork from anywhere\b", r"\bremote anywhere\b",
    r"\banywhere in the world\b", r"\bany location\b", r"\bany time\s*zone\b",
    r"\bglobally remote\b", r"\bglobal remote\b", r"\bremote\s*[-,:]\s*global\b",
]

# APAC/아시아 광역 (한국 포함) 신호.
_APAC = [
    r"\bAPAC\b", r"\basia[\s-]?pacific\b", r"\basia\b", r"\b(?:south )?korea\b",
    r"\bseoul\b", r"\bKST\b", r"\basia time\s*zone\b",
]

_LOC_RESTRICT_RE = [re.compile(p, re.I) for p in _LOC_RESTRICT]
_STRONG_RESTRICT_RE = [re.compile(p, re.I) for p in _STRONG_RESTRICT]
_WORLDWIDE_RE = [re.compile(p, re.I) for p in _WORLDWIDE]
_APAC_RE = [re.compile(p, re.I) for p in _APAC]


def _hits(text: str, patterns: list[re.Pattern]) -> list[str]:
    out: list[str] = []
    for pat in patterns:
        m = pat.search(text)
        if m:
            out.append(m.group(0))
    return out


def classify_remote_eligibility(
    location: str, is_remote: bool, description: str
) -> tuple[str | None, list[str]]:
    """(status, evidence) 반환. 원격이 아니면 (None, [])."""
    if not is_remote:
        return None, []
    loc = location or ""
    desc = description or ""
    blob = f"{loc}\n{desc}"

    strong = _hits(blob, _STRONG_RESTRICT_RE)
    if strong:  # 명시적 lock-out 이 최우선 (worldwide 신호보다 강함)
        return "region_restricted", strong[:3]

    worldwide = _hits(blob, _WORLDWIDE_RE)
    if worldwide:
        return "worldwide", worldwide[:3]

    apac = _hits(blob, _APAC_RE)
    if apac:
        return "apac_ok", apac[:3]

    loc_restrict = _hits(loc, _LOC_RESTRICT_RE)
    if loc_restrict:
        return "region_restricted", loc_restrict[:3]

    return "unclear", []
