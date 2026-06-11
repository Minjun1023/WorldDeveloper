"""제목에서 시니어리티(직급) 추출 — 정규식 키워드맵, 높은 직급 우선.

단어경계로 'leading'/'leadership' 가 'lead' 로 오탐되는 것을 막는다.
"""
from __future__ import annotations

import re

_LEVELS = [
    (re.compile(r"\bprincipal\b", re.I), "Principal"),
    (re.compile(r"\bstaff\b", re.I), "Staff"),
    (re.compile(r"\blead\b", re.I), "Lead"),
    (re.compile(r"\b(?:senior|sr)\b", re.I), "Senior"),
    (re.compile(r"\b(?:junior|jr)\b", re.I), "Junior"),
    (re.compile(r"\bintern\b", re.I), "Intern"),
    (re.compile(r"\bentry\b", re.I), "Entry"),
]


def extract_seniority(title: str) -> str | None:
    """제목에서 직급 라벨. 없으면 None."""
    if not title:
        return None
    for pat, label in _LEVELS:
        if pat.search(title):
            return label
    return None
