"""공고 본문에서 요구 경력(최소 연차) 추출.

해외 개발자 JD 에 흔한 'N+ years' / 'N-M years' / 'N years of experience' /
'at least N years' 패턴을 정규식으로 잡는다. 숫자뿐 아니라 영어로 풀어쓴 수
(one~twelve)·'or more'·'yrs'·years'(아포스트로피) 도 인식한다. 명확한 매치만(추정 금지).

선택: 본문에 먼저 나온 '필수' 값을 쓴다 — 'X years preferred'(우대) 매치는 건너뛴다.
  · "8+ years preferred, 5 years of experience required" → 5 (우대 8 을 건너뜀)
  · "seven or more years ... at least two years in leadership" → 7 (앞선 본 요건; 부수 2 아님)
단어경계로 100 같은 큰 수 오탐 방지, 0~40 범위만.
"""
from __future__ import annotations

import re

# 영어 수 → 숫자. JD 경력 표기에 나오는 one~twelve 정도면 충분.
_WORDS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
    "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12,
}
# 숫자(1~2자리) 또는 영어 단어 수.
_NUM = r"(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)"
_YEARS = r"(?:years?|yrs?)"  # year / years / yr / yrs

_PATTERNS = [
    re.compile(rf"\b{_NUM}\s*(?:\+|or\s+more)\s*{_YEARS}\b", re.I),
    re.compile(rf"\b{_NUM}\s*(?:[-–]|to)\s*\d{{1,2}}\s*{_YEARS}\b", re.I),
    re.compile(rf"\b{_NUM}\s*{_YEARS}['’]?\s+(?:of\s+)?(?:experience|exp\b)", re.I),
    re.compile(rf"(?:at least|minimum(?:\s+of)?|min\.?)\s+{_NUM}\s*{_YEARS}\b", re.I),
]

# 매치 바로 뒤 문맥이 '우대'면 필수 요건이 아니므로 후순위로 미룬다.
_PREFERRED = re.compile(r"\b(?:prefer|nice to have|a plus|bonus|ideal)", re.I)


def _to_int(tok: str) -> int | None:
    tok = tok.lower()
    return int(tok) if tok.isdigit() else _WORDS.get(tok)


def extract_experience_years(text: str) -> int | None:
    """본문에서 요구 최소 경력(년). 명확한 매치 없으면 None. 0~40 범위만."""
    if not text:
        return None
    hits: list[tuple[int, int, bool]] = []  # (위치, 연차, 우대여부)
    for pat in _PATTERNS:
        for m in pat.finditer(text):
            n = _to_int(m.group(1))
            if n is None or not (0 <= n <= 40):
                continue
            tail = text[m.end(): m.end() + 24]
            hits.append((m.start(), n, bool(_PREFERRED.search(tail))))
    if not hits:
        return None
    hits.sort(key=lambda h: h[0])  # 본문 등장 순
    required = [h for h in hits if not h[2]]
    return (required[0] if required else hits[0])[1]
