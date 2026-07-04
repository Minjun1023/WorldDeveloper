"""스폰서 명부 ↔ 레지스트리 회사 매칭(이름 + 위치 disambiguation + confidence).

verify_uk_sponsors / verify_h1b_sponsors / verify_ind_sponsors 가 공유한다.

설계 원칙:
- 정부 명부(UK Home Office·USCIS·NL IND)에는 **도메인이 없다.** 따라서 도메인은
  companies.json 의 회사 신원 키 + 검토 표시용이며, 매칭 자체는 **회사명**으로 한다.
- 매칭 후보 이름 = 브랜드(키) + token + 공식 별칭(aliases). 브랜드만 쓰던 기존 방식의
  "브랜드 vs 법인명"(Wise ↔ Wise Payments Ltd) 불일치 누락을 aliases 로 메운다.
- 위치(명부의 Town/County·City/State ↔ 회사 hq)는 **동명 후보 tie-break 와 confidence
  가점에만** 쓴다. 다국적 기업은 글로벌 HQ 와 현지 스폰서 법인 위치가 정상적으로
  다르므로(예: Datadog HQ=New York, UK 스폰서 법인=London), 위치 불일치를 단독
  reject 근거로 쓰지 않는다.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

# 법인/지역 접미사만 제거(업종어 bank/payments 등은 회사 구분에 필요하므로 유지).
_SUFFIX = re.compile(
    r"\b(ltd|limited|plc|inc|llc|gmbh|llp|group|holdings|uk|europe|international|branch|ab|se)\b"
)

# 위치 토큰에서 버릴 잡음어(국가/방위/일반어). 도시·고유지명만 남겨 교집합 신뢰도를 높인다.
_LOC_STOP = {
    "the", "of", "and", "city", "greater", "county", "north", "south", "east", "west",
    "united", "kingdom", "states", "america", "usa", "us", "uk",
}


def normalize(name: str) -> str:
    """회사명 정규화: 소문자 → 구두점을 공백 → 법인/지역 접미사 제거 → 공백 정리."""
    s = (name or "").lower()
    s = re.sub(r"[^a-z0-9 ]", " ", s)   # 구두점 -> 공백 (N.V. -> n v)
    s = _SUFFIX.sub(" ", s)
    return re.sub(r"\s+", " ", s).strip()


def match_company(brand: str, org_name: str) -> bool:
    """우리 회사 brand 가 명부 org_name 의 후보인지(관대). 정밀도는 사람 검토가 책임.

    규칙: 정규화 후 정확 일치, 또는 (brand 길이>=4) org 의 첫 토큰이 brand 와 정확히 같음.
    4자 미만 브랜드는 정확 일치만(오탐 폭주 방지).
    """
    nb = normalize(brand)
    no = normalize(org_name)
    if not nb or not no:
        return False
    if no == nb:
        return True
    if len(nb) >= 4 and no.startswith(nb + " "):
        return no.split(" ", 1)[0] == nb
    return False


def company_names(name: str, info: dict) -> set[str]:
    """매칭에 쓸 회사명 변형 집합: 레지스트리 키 + token + 공식 별칭(aliases)."""
    names = {name, info.get("token", "")}
    names |= set(info.get("aliases") or [])
    return {n for n in names if n}


def _loc_tokens(s: str | None) -> set[str]:
    """위치 문자열 → 비교용 토큰 집합(소문자, 2자 이상, 잡음어 제거)."""
    if not s:
        return set()
    toks = re.split(r"[^a-z0-9]+", s.lower())
    return {t for t in toks if len(t) >= 2 and t not in _LOC_STOP}


def location_signal(company_loc: str | None, register_loc: str | None) -> str:
    """회사 hq 와 명부 위치의 관계: 'agree' | 'conflict' | 'unknown'.

    'conflict' 는 reject 가 아니라 '가점 없음'을 의미한다(상단 설계 원칙 참고).
    """
    ta, tb = _loc_tokens(company_loc), _loc_tokens(register_loc)
    if not ta or not tb:
        return "unknown"
    return "agree" if (ta & tb) else "conflict"


@dataclass
class Candidate:
    org: str            # 명부상의 조직명(원문)
    loc: str            # 명부상의 위치(원문, 없으면 "")
    confidence: str     # "high" | "medium" | "low"
    location: str       # location_signal 결과: agree | conflict | unknown


_ORDER = {"high": 0, "medium": 1, "low": 2}


def find_candidates(
    names: set[str],
    company_loc: str | None,
    register: list[tuple[str, str]],
) -> list[Candidate]:
    """회사명 변형 집합으로 명부에서 후보를 찾고 confidence 를 매긴다(best-first).

    register: (조직명, 위치) 목록. 위치는 없으면 "".
    confidence:
      - 이름이 매칭된 후보가 1개  → 위치 agree 면 high, 아니면 medium(단독·비모호).
      - 이름이 매칭된 후보가 여러 개 → 위치 agree 인 것만 high, 나머지는 low(모호 → 사람 검토).
    이름이 하나도 안 맞으면 빈 리스트.
    """
    matched = [
        (org, loc)
        for org, loc in register
        if any(match_company(n, org) for n in names)
    ]
    if not matched:
        return []
    multi = len(matched) > 1
    out: list[Candidate] = []
    for org, loc in matched:
        sig = location_signal(company_loc, loc)
        if not multi:
            conf = "high" if sig == "agree" else "medium"
        else:
            conf = "high" if sig == "agree" else "low"
        out.append(Candidate(org=org, loc=loc, confidence=conf, location=sig))
    out.sort(key=lambda c: _ORDER[c.confidence])
    return out
