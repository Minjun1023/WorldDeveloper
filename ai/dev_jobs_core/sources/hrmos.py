"""HRMOS (hrmos.co) 일본 채용 ATS 커넥터.

공개 채용 페이지가 서버 사이드 렌더링(SSR) HTML 이라 JSON API 없이 파싱한다.
- 목록: GET /pages/{company}/jobs       → 공고 id + 제목 (전량 1페이지)
- 상세: GET /pages/{company}/jobs/{id}  → 제목/본문/근무지

`company` 는 회사의 hrmos 페이지 slug (예: cyberagent-group, koeitecmo).
요청 최소화: 목록 제목에 is_dev_role 를 먼저 적용해 개발직만 상세를 가져온다.
"""
from __future__ import annotations

import asyncio
import html as html_lib
import re
from html.parser import HTMLParser

import httpx

from ..filter import is_dev_role
from ..models import JobPosting

BASE = "https://hrmos.co/pages"

def _strip_html(s: str) -> str:
    text = re.sub(r"<[^>]+>", " ", s or "")
    return re.sub(r"\s+", " ", html_lib.unescape(text)).strip()


# 목록의 각 공고: <a href=".../jobs/{id}"> ... <h2>제목</h2> (앵커가 카드 제목을 감쌈).
# <li> 블록 분리는 추가 속성/중첩 <li> 에 취약하므로 앵커-제목 페어로 직접 매칭한다.
_CARD = re.compile(
    r'<a [^>]*?href="[^"]*?/jobs/(\d+)"[^>]*>.*?<h2[^>]*>(.*?)</h2>', re.DOTALL)


def _parse_list(html: str) -> list[tuple[str, str]]:
    """목록 HTML → [(native_id, title)]. 공고 앵커별 첫 <h2> 제목을 페어로 추출."""
    out: list[tuple[str, str]] = []
    seen: set[str] = set()
    for jid, raw_title in _CARD.findall(html):
        if jid in seen:
            continue
        seen.add(jid)
        out.append((jid, _strip_html(raw_title)))
    return out


# 자가닫힘/void 태그 — 깊이 추적에서 제외
_VOID = {"br", "img", "hr", "input", "meta", "link", "source", "wbr",
         "area", "base", "col", "embed", "param", "track"}


class _SectionText(HTMLParser):
    """주어진 class 를 가진 '첫' 컨테이너 안의 텍스트만 수집(중첩 깊이 추적)."""

    def __init__(self, target_class: str) -> None:
        super().__init__(convert_charrefs=True)
        self._target = target_class
        self._depth = 0
        self._active = False
        self._done = False
        self.parts: list[str] = []

    def handle_starttag(self, tag, attrs):
        if self._done or tag in _VOID:
            return
        if not self._active:
            classes = (dict(attrs).get("class") or "").split()
            if self._target in classes:
                self._active = True
                self._depth = 1
        else:
            self._depth += 1

    def handle_startendtag(self, tag, attrs):
        return  # 자가닫힘 태그는 깊이 변화 없음

    def handle_endtag(self, tag):
        if self._active and tag not in _VOID:
            self._depth -= 1
            if self._depth <= 0:
                self._active = False
                self._done = True

    def handle_data(self, data):
        if self._active:
            self.parts.append(data)

    @property
    def text(self) -> str:
        return re.sub(r"\s+", " ", "".join(self.parts)).strip()


def _section_text(html: str, target_class: str) -> str:
    p = _SectionText(target_class)
    p.feed(html)
    return p.text


_TITLE = re.compile(
    r'<h1[^>]*class="[^"]*sg-corporate-name[^"]*"[^>]*>(.*?)</h1>', re.DOTALL)


def _parse_detail(html: str) -> dict[str, str]:
    """상세 HTML → {title, description, location}."""
    tm = _TITLE.search(html)
    title = _strip_html(tm.group(1)) if tm else ""
    return {
        "title": title,
        "description": _section_text(html, "pg-descriptions"),
        "location": _section_text(html, "pg-location-address"),
    }


def _to_posting(company: str, native_id: str, list_title: str,
                detail: dict[str, str]) -> JobPosting:
    """파싱 결과 → JobPosting (순수 함수, 네트워크 없음)."""
    location = detail.get("location", "") or ""
    return JobPosting(
        job_id=f"hrmos:{company}:{native_id}",
        source="hrmos",
        title=detail.get("title") or list_title,
        company=company.replace("-", " ").title(),
        location=location,
        is_remote=("リモート" in location) or ("remote" in location.lower()),
        # HRMOS 는 고용형태 필드를 제공하지 않아 정규직으로 가정
        employment_type="FULLTIME",
        description=detail.get("description", ""),
        apply_url=f"{BASE}/{company}/jobs/{native_id}",
        posted_at="",
        closes_at="",
    )


_DETAIL_CONCURRENCY = 4


async def _fetch_text(client: httpx.AsyncClient, url: str) -> str | None:
    try:
        resp = await client.get(url)
        if resp.status_code != 200:
            return None
        return resp.text
    except httpx.HTTPError:
        return None


async def fetch(company: str, query: str = "", limit: int = 100) -> list[JobPosting]:
    list_url = f"{BASE}/{company}/jobs"
    async with httpx.AsyncClient(
        timeout=30, headers={"User-Agent": "dev-jobs-mcp/0.1"},
        follow_redirects=True,
    ) as client:
        list_html = await _fetch_text(client, list_url)
        if not list_html:
            return []

        # 제목 선필터: 개발직만 상세 fetch (is_dev_role 는 ETL 권위 필터와 동일 → recall 손실 없음)
        candidates = [(jid, t) for jid, t in _parse_list(list_html) if is_dev_role(t)]

        sem = asyncio.Semaphore(_DETAIL_CONCURRENCY)

        async def _one(jid: str, list_title: str) -> JobPosting | None:
            async with sem:
                detail_html = await _fetch_text(client, f"{BASE}/{company}/jobs/{jid}")
            if not detail_html:
                return None
            return _to_posting(company, jid, list_title, _parse_detail(detail_html))

        results = await asyncio.gather(
            *[_one(jid, t) for jid, t in candidates], return_exceptions=True)

    postings = [p for p in results if isinstance(p, JobPosting)]
    if query:
        ql = query.lower()
        postings = [p for p in postings if ql in f"{p.title} {p.description}".lower()]
    return postings[:limit]
