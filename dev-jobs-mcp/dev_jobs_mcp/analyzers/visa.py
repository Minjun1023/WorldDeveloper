"""공고 description 에서 비자 스폰서십 가능 여부를 분류.

분류 결과:
- sponsors    : 명시적으로 비자/relocation 제공
- no_sponsor  : 명시적으로 거부 (work authorization 필수 등)
- unclear     : 언급 없음 (대부분의 공고)

주의: 키워드 매칭이므로 100% 정확하지 않다. 최종 판단은 Claude 가
description 전문을 보고 내리도록 evidence 도 함께 반환한다.
"""
from __future__ import annotations
import re

# --- 명시적 거부 패턴 (가장 강한 시그널) ---
NO_SPONSOR_PATTERNS = [
    # English
    r"\bno\s+(?:visa\s+)?sponsorship\b",
    r"\b(?:we\s+(?:do\s+not|don[''']t|cannot|can[''']t))\s+sponsor\b",
    r"\bunable\s+to\s+sponsor\b",
    r"\bnot\s+able\s+to\s+sponsor\b",
    r"\bmust\s+(?:have|be)\s+(?:authorized|eligible)\s+to\s+work\b",
    r"\bmust\s+have\s+(?:valid\s+)?work\s+(?:authorization|permit|visa)\b",
    r"\bauthorization\s+to\s+work\s+(?:in|without\s+sponsorship)\b",
    r"\b(?:us\s+)?citizens?\s+only\b",
    r"\bgreen\s+card\s+holders?\s+only\b",
    r"\bno\s+(?:c2c|corp\s+to\s+corp|relocation)\b",
    # Deutsch
    r"\bkeine?\s+(?:visa[- ]?|visums[- ]?)?sponsoring\b",
    r"\bkein\s+visum\b",
    r"\bEU[- ]?Arbeitserlaubnis\s+(?:ist\s+)?erforderlich\b",
    r"\bArbeitserlaubnis\s+(?:ist\s+)?(?:zwingend\s+)?erforderlich\b",
    # Nederlands
    r"\bgeen\s+(?:visum[- ]?)?sponsoring\b",
    r"\bEU[- ]?werkvergunning\s+(?:is\s+)?vereist\b",
    r"\bwerkvergunning\s+vereist\b",
    # 日本語
    r"ビザ\s*(?:サポート|支援)\s*(?:なし|不可|はありません|は提供しません)",
    r"永住権(?:\s*が)?必須",
    r"就労ビザ\s*(?:不可|なし)",
    # 고신뢰 영어 추가 패턴
    r"\bauthorized\s+to\s+work\s+in\b",
    r"\b(?:legally\s+)?(?:eligible|entitled)\s+to\s+work\s+(?:in|without)\b",
    r"\bright\s+to\s+work\s+in\b",
    r"\bwithout\s+(?:visa\s+)?sponsorship\b",
    r"\bdo(?:es)?\s+not\s+(?:provide|offer)\s+(?:visa\s+)?sponsorship\b",
    r"\bwork\s+authorization\s+(?:is\s+)?required\b",
    r"\bexisting\s+work\s+authorization\b",
]

# --- 명시적 스폰서십 제공 패턴 ---
SPONSOR_PATTERNS = [
    # English
    r"\bvisa\s+sponsorship\b",
    r"\bwe\s+(?:will\s+)?sponsor\b",
    r"\bsponsorship\s+(?:is\s+)?(?:available|provided|offered)\b",
    r"\boffer\s+(?:visa\s+)?sponsorship\b",
    r"\bh[-\s]?1b\s+(?:sponsorship|transfer|visa)\b",
    r"\bblue\s+card\b",
    r"\bskilled\s+worker\s+visa\b",
    r"\btier\s+2\s+(?:sponsorship|visa)\b",
    r"\brelocation\s+(?:package|assistance|support|bonus)\b",
    r"\bwill\s+(?:help|assist)\s+(?:with|you).*?relocat",
    r"\bwork\s+permit\s+(?:sponsorship|support)\b",
    r"\beu\s+blue\s+card\b",
    r"\bsponsor\s+work\s+visas?\b",
    # Deutsch
    r"\bvisums?[- ]?sponsoring\b",
    r"\bvisum[- ]?(?:unterst[üu]tzung|hilfe)\b",
    r"\bBlaue\s+Karte\b",
    r"\bArbeitsvisum\b",
    r"\bUmzugshilfe\b",
    r"\bRelocation[- ]?Paket\b",
    r"\bwir\s+unterst[üu]tzen\s+(?:bei|mit)\s+(?:dem\s+)?visum\b",
    # Nederlands
    r"\bvisumsponsoring\b",
    r"\bwij\s+sponsoren\s+visa\b",
    r"\bkennismigrant(?:enregeling)?\b",
    r"\b30%[- ]?(?:ruling|regeling)\b",
    r"\bverhuiskosten(?:vergoeding)?\b",
    # 日本語
    r"ビザ\s*(?:サポート|支援)(?!\s*(?:なし|不可|はありません))",
    r"就労ビザ\s*(?:取得)?支援",
    r"在留資格\s*(?:取得)?支援",
    r"リロケーション\s*(?:支援|サポート)",
    # 고신뢰 영어 추가 패턴
    r"\bvisa\s+support\b",
    r"\bwe\s+sponsor\s+(?:work\s+)?visas?\b",
    r"\bsponsor\s+(?:your\s+)?(?:work\s+)?visa\b",
    r"\brelocation\s+(?:reimbursement|stipend)\b",
    r"\bvisa\s+(?:and\s+|&\s+)?relocation\b",
]

# 컴파일된 패턴 (대소문자 무시)
_NO_SPONSOR_RE = [re.compile(p, re.IGNORECASE) for p in NO_SPONSOR_PATTERNS]
_SPONSOR_RE = [re.compile(p, re.IGNORECASE) for p in SPONSOR_PATTERNS]

# Sponsor 매칭 주변에 등장하면 의미를 뒤집는 부정 표현 (영어 + DE + NL + JA)
# 일본어는 어미에 부정사가 붙어 post-match 윈도우에서 잡힘.
_NEGATION_RE = re.compile(
    r"(?:"
    # English
    r"\b(?:not|no|never|cannot|can(?:not|'t|[’]t)|won(?:'t|[’]t)|"
    r"don(?:'t|[’]t)|doesn(?:'t|[’]t)|didn(?:'t|[’]t)|"
    r"unable|without|isn(?:'t|[’]t)|aren(?:'t|[’]t)|"
    r"wasn(?:'t|[’]t)|weren(?:'t|[’]t))\b"
    # Deutsch
    r"|\b(?:kein|keine|keiner|keines|nicht|niemals|ohne)\b"
    # Nederlands
    r"|\b(?:geen|niet|nooit|zonder)\b"
    # 日本語 (어미 부정형, 문자 클래스라 \b 무의미)
    r"|なし|ありません|提供しません|不可|できません|不要"
    r")",
    re.IGNORECASE,
)


def classify_visa(description: str) -> tuple[str, list[str]]:
    """공고 description 을 분석해 (status, evidence) 반환.

    Returns:
        status: "sponsors" / "no_sponsor" / "unclear"
        evidence: 매칭된 원문 문장(또는 단편) 리스트

    동작:
      1) 명시적 NO_SPONSOR 패턴이 있으면 → no_sponsor
      2) SPONSOR 패턴이 매칭되더라도 매칭 주변(앞 40자/뒤 50자) 에
         부정어가 있으면 그 매칭은 no_sponsor 증거로 격상
         (예: "Relocation support is not available", "not able to provide visa sponsorship")
      3) 부정 없는 sponsor 매칭이 있으면 → sponsors
      4) 그 외 → unclear
    """
    if not description:
        return "unclear", []

    no_sponsor_hits = _find_hits(description, _NO_SPONSOR_RE)
    affirmative, negated = _find_sponsor_hits(description, _SPONSOR_RE)

    if no_sponsor_hits or negated:
        combined = (no_sponsor_hits + negated)[:3]
        return "no_sponsor", combined

    if affirmative:
        return "sponsors", affirmative[:3]

    return "unclear", []


def _find_hits(text: str, patterns: list[re.Pattern]) -> list[str]:
    """매칭된 패턴의 주변 문장을 evidence 로 추출 (필터 없음, no_sponsor 용)."""
    hits: list[str] = []
    seen: set[str] = set()
    for pat in patterns:
        for match in pat.finditer(text):
            snippet = _snippet(text, match.start(), match.end())
            if snippet not in seen:
                seen.add(snippet)
                hits.append(snippet)
            if len(hits) >= 3:
                return hits
    return hits


def _find_sponsor_hits(
    text: str, patterns: list[re.Pattern]
) -> tuple[list[str], list[str]]:
    """Sponsor 패턴 매칭을 (affirmative, negated) 두 리스트로 분리.

    매칭 직전 40자 또는 직후 50자 안에 부정어가 있으면 negated.
    """
    affirmative: list[str] = []
    negated: list[str] = []
    seen: set[str] = set()
    for pat in patterns:
        for match in pat.finditer(text):
            snippet = _snippet(text, match.start(), match.end())
            if snippet in seen:
                continue
            seen.add(snippet)
            pre = text[max(0, match.start() - 40): match.start()]
            post = text[match.end(): min(len(text), match.end() + 50)]
            if _NEGATION_RE.search(pre) or _NEGATION_RE.search(post):
                negated.append(snippet)
            else:
                affirmative.append(snippet)
    return affirmative, negated


def _snippet(text: str, m_start: int, m_end: int) -> str:
    start = max(0, m_start - 40)
    end = min(len(text), m_end + 40)
    s = text[start:end].strip()
    s = re.sub(r"\s+", " ", s)
    return f"...{s}..."
