"""크로스소스 중복제거: job_id 완전일치 + 정규화 키 + 소스 우선순위."""
from __future__ import annotations

import re

from .models import JobPosting

# 높을수록 우선 채택 (신뢰도: ATS > 네이티브 보드 > 집계)
_SOURCE_PRIORITY = {
    "greenhouse": 3, "lever": 3, "ashby": 3, "smartrecruiters": 3,
    "remoteok": 2, "arbeitnow": 2, "wwr": 2,
    "adzuna": 1,
}

_SUFFIX = re.compile(r"\b(inc|llc|ltd|gmbh|b\.?v|ab|oy|sa|co|corp|company)\b\.?", re.IGNORECASE)
_NONWORD = re.compile(r"[^a-z0-9가-힣]+")


def _priority(source: str) -> int:
    return _SOURCE_PRIORITY.get(source, 0)


def _norm(s: str) -> str:
    s = (s or "").lower()
    s = _SUFFIX.sub(" ", s)
    s = _NONWORD.sub(" ", s)
    return " ".join(s.split())


def _key(p: JobPosting) -> str:
    loc = _norm(p.location).split()
    loc_key = loc[0] if loc else ""
    return f"{_norm(p.company)}|{_norm(p.title)}|{loc_key}"


def dedup(postings: list[JobPosting]) -> list[JobPosting]:
    # 1차: job_id 완전일치
    by_id: dict[str, JobPosting] = {}
    for p in postings:
        by_id[p.job_id] = p
    # 2차: 정규화 키 + 소스 우선순위
    best: dict[str, JobPosting] = {}
    for p in by_id.values():
        k = _key(p)
        cur = best.get(k)
        if cur is None or _priority(p.source) > _priority(cur.source):
            best[k] = p
    return list(best.values())
