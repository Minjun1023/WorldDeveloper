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
import json as json_lib
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
    r'<a [^>]*?href="[^"]*?/jobs/(\d+)[^"]*"[^>]*>.*?<h2[^>]*>(.*?)</h2>', re.DOTALL)


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


class _SectionText(HTMLParser):
    """주어진 class 를 가진 '첫' 컨테이너 안의 텍스트만 수집.

    깊이는 '컨테이너와 같은 태그'의 중첩만 센다 — SSR 에서 흔한 닫히지 않은
    <p>/<li> 가 깊이를 망가뜨려 다음 섹션까지 과수집하는 것을 막는다.
    """

    def __init__(self, target_class: str) -> None:
        super().__init__(convert_charrefs=True)
        self._target = target_class
        self._tag: str | None = None
        self._depth = 0
        self._active = False
        self._done = False
        self.parts: list[str] = []

    def handle_starttag(self, tag, attrs):
        if self._done:
            return
        if not self._active:
            classes = (dict(attrs).get("class") or "").split()
            if self._target in classes:
                self._active = True
                self._tag = tag
                self._depth = 1
        elif tag == self._tag:
            self._depth += 1

    def handle_endtag(self, tag):
        if self._active and tag == self._tag:
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

# HRMOS 상세 페이지는 schema.org JobPosting 을 JSON-LD 로 임베드한다 — div 스크레이프보다
# 훨씬 풍부(전체 본문 HTML·연봉·고용형태·게시/마감일·구조화 주소). 이를 1순위로 쓴다.
_LD_RE = re.compile(
    r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', re.DOTALL | re.IGNORECASE)
_EMP_MAP = {
    "FULL_TIME": "FULLTIME", "PART_TIME": "PARTTIME",
    "CONTRACTOR": "CONTRACTOR", "TEMPORARY": "TEMPORARY", "INTERN": "INTERN",
}


def _parse_jsonld(html: str) -> dict | None:
    """페이지의 첫 JobPosting JSON-LD 를 반환(없으면 None). @graph/리스트 래핑도 처리."""
    for m in _LD_RE.finditer(html):
        try:
            data = json_lib.loads(m.group(1))
        except (ValueError, TypeError):
            continue
        candidates = data.get("@graph", [data]) if isinstance(data, dict) else data
        if not isinstance(candidates, list):
            candidates = [candidates]
        for d in candidates:
            if isinstance(d, dict) and d.get("@type") == "JobPosting":
                return d
    return None


def _jsonld_location(d: dict) -> str:
    """jobLocation 주소 → "도도부현 시구" 형태(여러 곳이면 '; ' 결합)."""
    locs = d.get("jobLocation")
    if isinstance(locs, dict):
        locs = [locs]
    if not isinstance(locs, list):
        return ""
    out: list[str] = []
    for loc in locs:
        addr = (loc or {}).get("address") if isinstance(loc, dict) else None
        if not isinstance(addr, dict):
            continue
        seg = " ".join(x for x in (addr.get("addressRegion"), addr.get("addressLocality")) if x)
        if seg:
            out.append(seg)
    return "; ".join(out)


def _jsonld_salary(d: dict) -> tuple[int | None, int | None, str, str]:
    """baseSalary → (min, max, currency, period). 값 없으면 (None, None, '', '')."""
    bs = d.get("baseSalary")
    val = bs.get("value") if isinstance(bs, dict) else None
    if not isinstance(val, dict):
        return (None, None, "", "")

    def _int(v):
        return int(v) if isinstance(v, (int, float)) else None

    lo, hi = _int(val.get("minValue")), _int(val.get("maxValue"))
    if lo is None and hi is None:
        return (None, None, "", "")
    period = (val.get("unitText") or "").upper()
    if period not in ("YEAR", "MONTH", "HOUR"):
        period = "YEAR"
    return (lo, hi, bs.get("currency") or "", period)


def _parse_detail(html: str) -> dict:
    """상세 HTML → {title, description, location, posted_at, closes_at, employment_type, salary}.

    JSON-LD(JobPosting) 우선, 없으면 기존 div 스크레이프로 폴백."""
    ld = _parse_jsonld(html)
    if ld is not None:
        emp = ld.get("employmentType")
        if isinstance(emp, list):
            emp = emp[0] if emp else ""
        return {
            "title": _strip_html(ld.get("title") or ""),
            "description": ld.get("description") or "",  # 전체 본문 HTML(raw)
            "location": _jsonld_location(ld),
            "posted_at": ld.get("datePosted") or "",
            "closes_at": ld.get("validThrough") or "",
            "employment_type": _EMP_MAP.get((emp or "").upper(), ""),
            "salary": _jsonld_salary(ld),
        }
    tm = _TITLE.search(html)
    return {
        "title": _strip_html(tm.group(1)) if tm else "",
        "description": _section_text(html, "pg-descriptions"),
        "location": _section_text(html, "pg-location-address"),
        "posted_at": "",
        "closes_at": "",
        "employment_type": "",
        "salary": (None, None, "", ""),
    }


def _to_posting(company: str, native_id: str, list_title: str,
                detail: dict) -> JobPosting:
    """파싱 결과 → JobPosting (순수 함수, 네트워크 없음)."""
    location = detail.get("location", "") or ""
    sal = detail.get("salary") or (None, None, "", "")
    return JobPosting(
        job_id=f"hrmos:{company}:{native_id}",
        source="hrmos",
        title=detail.get("title") or list_title,
        company=company.replace("-", " ").title(),
        location=location,
        is_remote=("リモート" in location) or ("remote" in location.lower()),
        # JSON-LD 의 employmentType, 없으면 정규직 가정.
        employment_type=detail.get("employment_type") or "FULLTIME",
        description=detail.get("description", ""),
        apply_url=f"{BASE}/{company}/jobs/{native_id}",
        posted_at=detail.get("posted_at", "") or "",
        closes_at=detail.get("closes_at", "") or "",
        salary_min=sal[0],
        salary_max=sal[1],
        salary_currency=sal[2],
        salary_period=sal[3],
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
