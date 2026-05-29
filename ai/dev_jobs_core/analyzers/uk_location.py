"""공고 location 문자열이 영국(UK) 소재인지 판별하는 휴리스틱. 순수 함수, 네트워크 없음.

UK 스폰서 라이선스는 UK 채용을 스폰서하므로, 회사가 명부에 있어도 공고가
UK 소재일 때만 sponsors 로 전환하기 위해 사용한다(보수적 게이팅).
"""
from __future__ import annotations

import re

# 국가/지역 신호 (단어경계). 단독 "gb"는 오탐 위험 대비 효용이 낮아 제외(great britain 은 유지).
_REGION = re.compile(
    r"\b(united kingdom|u\.k\.|uk|england|scotland|wales|northern ireland|great britain)\b",
    re.IGNORECASE,
)
# 주요 UK 도시 (단어경계).
# 알려진 한계: 일부 도시명은 비UK 동음이의 지명과 충돌한다(예: Birmingham, Alabama /
# London, Ontario / Cambridge, MA). 단, 이 함수는 "회사가 큐레이션된 UK 스폰서"라는
# 게이트와 AND 로만 쓰이고 결과가 사용자에게 유리한 방향(sponsors)이라 위험 범위가 좁다.
_CITIES = re.compile(
    r"\b(london|manchester|edinburgh|glasgow|birmingham|leeds|bristol|cardiff|"
    r"belfast|cambridge|oxford|liverpool|sheffield|nottingham|newcastle|"
    r"brighton|reading)\b",
    re.IGNORECASE,
)


def is_uk_location(location: str | None, is_remote: bool = False) -> bool:
    """location 이 UK 소재 신호를 가지면 True. 모호한 remote/EU/US/None 은 False."""
    if not location:
        return False
    text = location.strip()
    if not text:
        return False
    return bool(_REGION.search(text) or _CITIES.search(text))
