"""HRMOS (hrmos.co) 일본 채용 ATS 커넥터.

공개 채용 페이지가 서버 사이드 렌더링(SSR) HTML 이라 JSON API 없이 파싱한다.
- 목록: GET /pages/{company}/jobs       → 공고 id + 제목 (전량 1페이지)
- 상세: GET /pages/{company}/jobs/{id}  → 제목/본문/근무지

`company` 는 회사의 hrmos 페이지 slug (예: cyberagent-group, koeitecmo).
요청 최소화: 목록 제목에 is_dev_role 를 먼저 적용해 개발직만 상세를 가져온다.
"""
from __future__ import annotations

import html as html_lib
import re

BASE = "https://hrmos.co/pages"

# 목록의 각 공고 카드 (<li class="pg-list-cassette ...">...</li>)
_CASSETTE = re.compile(r'<li class="pg-list-cassette[^"]*">(.*?)</li>', re.DOTALL)
_JOB_HREF = re.compile(r'href="[^"]*?/jobs/(\d+)"')
_H2 = re.compile(r"<h2[^>]*>(.*?)</h2>", re.DOTALL)


def _strip_html(s: str) -> str:
    text = re.sub(r"<[^>]+>", " ", s or "")
    return re.sub(r"\s+", " ", html_lib.unescape(text)).strip()


def _parse_list(html: str) -> list[tuple[str, str]]:
    """목록 HTML → [(native_id, title)]. 카드별 첫 job id + 첫 <h2> 제목."""
    out: list[tuple[str, str]] = []
    seen: set[str] = set()
    for block in _CASSETTE.findall(html):
        m = _JOB_HREF.search(block)
        if not m:
            continue
        jid = m.group(1)
        if jid in seen:
            continue
        seen.add(jid)
        h2 = _H2.search(block)
        title = _strip_html(h2.group(1)) if h2 else ""
        out.append((jid, title))
    return out
