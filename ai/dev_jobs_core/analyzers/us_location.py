"""공고 location 문자열이 미국(US) 소재인지 판별하는 휴리스틱. 순수 함수, 네트워크 없음.

H-1B 는 미국 비자이므로, 회사가 H-1B 스폰서 이력이 있어도 공고가 미국 소재일 때만
sponsors 로 전환하기 위해 사용한다(보수적 게이팅).

주의: 2글자 주 약어(TX, CA …)는 영어 단어(or, in, me, ok …)와 충돌하므로
"City, XX" 콤마 패턴 + 대문자에서만 인정한다.
"""
from __future__ import annotations

import re

# 강한 국가 신호. "United States"/"USA" 는 대소문자 무관,
# 단독 US/U.S. 는 대문자만(소문자 "us" 오탐 방지).
_COUNTRY_CI = re.compile(r"\b(united states|usa)\b", re.IGNORECASE)
# 단독 US 는 단어경계, 점표기 U.S./U.S.A. 는 trailing "." 때문에 \b가 안 걸리므로 별도 처리.
_COUNTRY_CS = re.compile(r"\bUS\b|U\.S\.A\.|U\.S\.")  # 대소문자 구분(대문자만)

# 전체 주 이름 + DC (단어경계)
_STATES_FULL = re.compile(
    r"\b(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|"
    r"florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|"
    r"maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|"
    r"nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|"
    r"north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|"
    r"south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|"
    r"wisconsin|wyoming|district of columbia)\b",
    re.IGNORECASE,
)
# 주요 US 도시 (단어경계)
_CITIES = re.compile(
    r"\b(new york|san francisco|seattle|austin|boston|chicago|los angeles|denver|"
    r"atlanta|mountain view|palo alto|san jose|sunnyvale|cupertino|san diego|dallas|"
    r"houston|miami|philadelphia|portland|nashville|brooklyn|menlo park|santa clara|"
    r"bellevue|redmond)\b",
    re.IGNORECASE,
)
# 2글자 주 약어: ", XX" 패턴 + 대문자에서만 (re.IGNORECASE 쓰지 않음)
_STATE_ABBR = re.compile(
    r",\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|"
    r"MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|"
    r"WI|WY|DC)\b"
)


def is_us_location(location: str | None, is_remote: bool = False) -> bool:
    """location 이 미국 소재 신호를 가지면 True. EU/UK/모호한 remote/None 은 False."""
    if not location:
        return False
    text = location.strip()
    if not text:
        return False
    return bool(
        _COUNTRY_CI.search(text)
        or _COUNTRY_CS.search(text)
        or _STATES_FULL.search(text)
        or _CITIES.search(text)
        or _STATE_ABBR.search(text)
    )
