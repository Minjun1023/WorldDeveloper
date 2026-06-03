"""공고 location 문자열이 네덜란드(NL) 소재인지 판별하는 휴리스틱. 순수 함수, 네트워크 없음.

IND 인정 스폰서(erkende referent)는 네덜란드 고용을 스폰서하므로, 회사가 명부에 있어도
공고가 NL 소재일 때만 sponsors 로 전환하기 위해 사용한다(보수적 게이팅). uk_location 미러.
"""
from __future__ import annotations

import re

# 국가/지역 신호 (단어경계, 대소문자 무시).
_REGION = re.compile(
    r"\b(netherlands|the netherlands|holland|nederland)\b",
    re.IGNORECASE,
)
# 국가코드 NL 은 대소문자 구분(소문자 'nl' 오탐 방지 — 예 'mysql', 단어 안 'nl').
_NL_CODE = re.compile(r"\bNL\b")
# 주요 NL 도시 (단어경계). 회사가 큐레이션된 IND 스폰서라는 게이트와 AND 로만 쓰여 위험 좁음.
_CITIES = re.compile(
    r"\b(amsterdam|rotterdam|the hague|den haag|eindhoven|utrecht|groningen|"
    r"delft|hilversum|haarlem|tilburg|almere|nijmegen|leiden|amersfoort|"
    r"zwolle|breda|arnhem|maastricht)\b",
    re.IGNORECASE,
)


def is_nl_location(location: str | None, is_remote: bool = False) -> bool:
    """location 이 NL 소재 신호를 가지면 True. 모호한 remote/EU/US/None 은 False."""
    if not location:
        return False
    text = location.strip()
    if not text:
        return False
    return bool(_REGION.search(text) or _CITIES.search(text) or _NL_CODE.search(text))
