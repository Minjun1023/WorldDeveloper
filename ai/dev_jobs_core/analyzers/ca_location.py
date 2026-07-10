"""공고 location 문자열이 캐나다(CA) 소재인지 판별하는 휴리스틱. 순수 함수, 네트워크 없음.

캐나다 LMIA 승인은 캐나다 채용을 대상으로 하므로, 회사가 명부에 있어도 공고가
캐나다 소재일 때만 sponsors 로 전환하기 위해 사용한다(보수적 게이팅). uk/us/nl 과 동일 패턴.
"""
from __future__ import annotations

import re

# 국가/주(province) 신호 (단어경계).
_REGION = re.compile(
    r"\b(canada|ontario|quebec|québec|alberta|british columbia|manitoba|"
    r"saskatchewan|nova scotia|newfoundland|new brunswick)\b",
    re.IGNORECASE,
)
# 주요 캐나다 도시 (단어경계).
# 알려진 한계: 일부 도시명은 비캐나다 동음이의 지명과 충돌(London, Ontario / Hamilton, NZ 등).
# 단, 이 함수는 "회사가 큐레이션된 캐나다 LMIA 스폰서"라는 게이트와 AND 로만 쓰이고 결과가
# 사용자에게 유리한 방향(sponsors)이라 위험 범위가 좁다. 모호한 London 등은 제외한다.
_CITIES = re.compile(
    r"\b(toronto|vancouver|montreal|montréal|ottawa|calgary|edmonton|waterloo|"
    r"mississauga|winnipeg|halifax|kitchener|gatineau|burnaby|markham)\b",
    re.IGNORECASE,
)


def is_ca_location(location: str | None, is_remote: bool = False) -> bool:
    """location 이 캐나다 소재 신호를 가지면 True. 모호한 remote/US/None 은 False."""
    if not location:
        return False
    text = location.strip()
    if not text:
        return False
    return bool(_REGION.search(text) or _CITIES.search(text))
