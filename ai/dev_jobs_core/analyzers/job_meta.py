"""본문 정규식 메타 추출 — 이주(relocation) 지원 / 어학 요건.

LLM 없이 동작한다(비용 0). 샘플 100건 LLM 대조에서 두 필드 모두 정형 문구라
정규식 커버리지가 LLM 과 동급임을 확인했다(relocation 3.1% vs 2%, 어학 1.8% vs 1%).
정직성 원칙: '명시 문구'만 인정 — 애매하면 None(표시 안 함)이 잘못된 배지보다 낫다.
"""
from __future__ import annotations

import re

# ── relocation ───────────────────────────────────────────────────────────────
# 회사가 이주를 '지원(혜택)'하는 명시 문구. (다국어: 영/독/일)
_RELO_OFFER = re.compile(
    r"relocation\s+(assistance|support|package|bonus|budget|benefits?|stipend)"
    r"|(assist|support|help)(ing|s)?\s+(you\s+)?with\s+(your\s+)?relocation"
    r"|relocation\s*\?\s*yes"
    r"|(provide|offer)(s|ing)?\s+(a\s+)?relocation"
    r"|visa\s+and\s+relocation"
    r"|umzugsunterstützung"           # 독일어: 이사 지원
    r"|引っ越し補助|引越補助",  # 일본어: 引っ越し補助/引越補助
    re.I,
)
# '지원자가 이주할 수 있어야 함'(요구사항) — 혜택으로 오인 금지.
_RELO_REQUIREMENT = re.compile(
    r"(available|willing(ness)?|ability|able|open|must|required?)\s+to\s+relocate", re.I)
# 명시적 '이주 지원 없음'.
_RELO_NO = re.compile(
    r"no\s+relocation(\s+(assistance|support|package|budget))?"
    r"|relocation\s+(is\s+|will\s+)?not\s+(be\s+)?(provided|offered|available|supported)"
    # "not able to support visa applications or relocation" 처럼 사이 단어 허용(마침표 전까지).
    r"|(unable|not able)\s+to\s+(provide|offer|support)[^.]{0,50}relocation",
    re.I,
)


def extract_relocation(text: str | None) -> bool | None:
    """이주 지원 여부. True=명시 지원, False=명시 거부, None=무언급(대다수)."""
    if not text:
        return None
    if _RELO_NO.search(text):
        return False
    m = _RELO_OFFER.search(text)
    if m:
        # 같은 문장 안이 아니라도, 요구형 문구만 있고 offer 가 그 일부인 경우를 방지.
        window = text[max(0, m.start() - 60): m.start()]
        if _RELO_REQUIREMENT.search(window + m.group(0)):
            return None
        return True
    return None


# ── language ────────────────────────────────────────────────────────────────
_LANGS = "german|japanese|french|dutch|korean|spanish|portuguese|italian|polish|swedish|mandarin|chinese"
# "fluent German", "business-level Japanese", "German (B2)" 등 — 요구 문맥.
_LANG_REQ = re.compile(
    # "fluent in English and German" — 영어와 병기된 현지어도 요구로 잡는다(english and 브리지).
    rf"(fluent(\s+in)?|fluency\s+in|proficien\w*\s+in|business[- ]level|native|professional)\s+(?:level\s+)?(?:english\s+and\s+)?(?P<l1>{_LANGS})"
    rf"|(?P<l2>{_LANGS})\s*(\((?:b1|b2|c1|c2)\)|at\s+(?:b1|b2|c1|c2))"
    rf"|(?P<l3>{_LANGS})\s+(language\s+)?(?:is\s+)?(required|mandatory|a\s+must|essential)",
    re.I,
)
# '우대/가산점' 문맥이면 요구가 아님.
_LANG_PLUS = re.compile(r"(nice to have|is a plus|a plus|preferred|bonus|advantageous|plus point)", re.I)
# 영어가 업무 언어임을 명시(현지어 불필요 신호).
_LANG_EN_ONLY = re.compile(
    # english 뒤에 "and German" 처럼 다른 요구 언어가 붙으면 english-only 가 아니다(lookahead 제외).
    rf"(full\s+)?professional\s+(proficiency|fluency)\s+in\s+english(?!\s+and\s+(?:{_LANGS}))"
    rf"|fluent\s+(in\s+)?(written\s+and\s+spoken\s+|spoken\s+and\s+written\s+)?english(?!\s+and\s+(?:{_LANGS}))"
    rf"|proficien\w*\s+in\s+(verbal\s+and\s+written\s+|written\s+and\s+spoken\s+)?english(?!\s+and\s+(?:{_LANGS}))"
    r"|english\s+(is\s+)?(the\s+|our\s+)?(main\s+|primary\s+|official\s+|working\s+|company\s+)language"
    r"|english[- ]speaking\s+(work(place|ing)?\s+)?environment"
    r"|(working|company|office)\s+language\s+is\s+english"
    rf"|no\s+(?:{_LANGS})\s+(language\s+)?(skills?\s+)?(is\s+)?(required|needed|necessary)"
    rf"|no\s+need\s+to\s+speak\s+(?:{_LANGS})"
    rf"|(?:{_LANGS})\s+is\s+(a\s+plus\s+but\s+)?not\s+required",
    re.I,
)


def extract_language(text: str | None) -> str | None:
    """어학 요건. 'german' 등 현지어 요구 / 'english_only' / None(무언급)."""
    if not text:
        return None
    for m in _LANG_REQ.finditer(text):
        # 매치 뒤 ~40자에 '우대' 문구가 붙으면 요구가 아니다.
        tail = text[m.end(): m.end() + 40]
        if _LANG_PLUS.search(tail):
            continue
        lang = (m.group("l1") or m.group("l2") or m.group("l3") or "").lower()
        if lang == "mandarin":
            lang = "chinese"
        if lang and lang != "english":
            return lang
    if _LANG_EN_ONLY.search(text):
        return "english_only"
    return None
