"""원격 공고의 한국 거주자 지원 가능 권역을 분류. analyzers/visa.py 미러.

분류 결과:
- worldwide         : 전 세계 원격 (한국 포함) → 지원 가능
- apac_ok           : APAC/아시아 광역 (한국 포함) → 지원 가능
- region_restricted : 특정 비-한국 권역 한정 (한국 제외) → 지원 불가
- unclear           : 원격이지만 권역 명시 없음 (worldwide 추정 금지 — 정직)
- None              : 원격 아님(온사이트)

설계 원칙 (라이브 2368건 검증으로 보정):
- location 필드가 권위. 짧고 큐레이션돼 있어 권역 판정의 1차 기준이다.
- description 본문 키워드는 노이즈가 크다("worldwide leader", "support our APAC clients").
  따라서 본문에선 (a) 명시적 lock-out 표현과 (b) worldwide '구문'(work from anywhere 등)
  만 신뢰하고, 맨 단어 worldwide/APAC/Asia 는 본문에서 신호로 쓰지 않는다.
- location 이 worldwide/APAC/한국 도 아니면서 특정 지명을 담고 있으면 region_restricted
  (한국이 명시 권역에 포함되지 않음). 모호하면 worldwide 추정 금지 → unclear.
"""
from __future__ import annotations

import re

# 명시적 lock-out (location/description 어디에 있든 최우선).
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

# location 필드 전용 worldwide 토큰 (맨 단어 허용 — 짧은 필드라 신뢰 가능).
_LOC_WORLDWIDE = [
    r"\bworld[\s-]?wide\b", r"\bglobal(?:ly)?\b", r"\banywhere\b", r"\binternational\b",
]

# APAC·한국 (한국 포함 광역). location 에서만 사용.
_APAC = [
    r"\bAPAC\b", r"\basia[\s-]?pacific\b", r"\basia\b", r"\b(?:south )?korea\b",
    r"\bseoul\b", r"\bKST\b",
]

# description 본문 전용 worldwide '구문' (맨 단어 worldwide 는 제외 — 마케팅 노이즈).
_DESC_WORLDWIDE = [
    r"\bwork from anywhere\b", r"\bremote from anywhere\b", r"\bremote anywhere\b",
    r"\banywhere in the world\b", r"\bany time\s*zone\b",
]

# location 에서 filler 를 제거하고 남는 알파벳 = 특정 지명(권역 한정 신호).
_FILLER = (
    r"\b(?:remote|hybrid|on[\s-]?site|onsite|work from home|wfh|fully|flexible|"
    r"distributed|based|anywhere)\b"
)

_STRONG_RE = [re.compile(p, re.I) for p in _STRONG_RESTRICT]
_LOC_WW_RE = [re.compile(p, re.I) for p in _LOC_WORLDWIDE]
_APAC_RE = [re.compile(p, re.I) for p in _APAC]
_DESC_WW_RE = [re.compile(p, re.I) for p in _DESC_WORLDWIDE]
_FILLER_RE = re.compile(_FILLER, re.I)


def _hit(text: str, patterns: list[re.Pattern]) -> str | None:
    for pat in patterns:
        m = pat.search(text)
        if m:
            return m.group(0)
    return None


def _residual_place(loc: str) -> str:
    """location 에서 filler/구두점 제거 후 남는 지명 텍스트 (없으면 '')."""
    s = _FILLER_RE.sub(" ", loc)
    s = re.sub(r"[^a-zA-Z]+", " ", s).strip()
    return s


def classify_remote_eligibility(
    location: str, is_remote: bool, description: str
) -> tuple[str | None, list[str]]:
    """(status, evidence) 반환. 원격이 아니면 (None, [])."""
    if not is_remote:
        return None, []
    loc = location or ""
    desc = description or ""

    # 0. 명시적 lock-out 은 어디에 있든 최우선.
    strong = _hit(f"{loc}\n{desc}", _STRONG_RE)
    if strong:
        return "region_restricted", [strong]

    # 1. location 권위 판정 (worldwide/APAC → 통과, 특정 지명 → 한정).
    if loc.strip():
        ww = _hit(loc, _LOC_WW_RE)
        if ww:
            return "worldwide", [ww]
        apac = _hit(loc, _APAC_RE)
        if apac:
            return "apac_ok", [apac]
        if _residual_place(loc):  # 특정 지명이 남음 → 한국 명시 권역 아님.
            return "region_restricted", [loc.strip()[:70]]
        # 여기 도달 = location 이 'Remote' 등 filler 뿐 → 본문으로.

    # 2. location 이 비었거나 bare-remote → description 은 약한 신호(구문만 신뢰).
    ww = _hit(desc, _DESC_WW_RE)
    if ww:
        return "worldwide", [ww]
    return "unclear", []
