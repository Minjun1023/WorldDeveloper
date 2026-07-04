"""Greenhouse Job Board API.

회사별 공식 공개 API. 키 불필요.
https://boards-api.greenhouse.io/v1/boards/{company}/jobs?content=true

`company` 는 회사의 greenhouse board token (예: stripe, airbnb, notion).
회사가 Greenhouse 를 ATS 로 쓰는 경우에만 동작한다.
"""
from __future__ import annotations

import html as html_lib
import re
from urllib.parse import quote

import httpx

from ..models import JobPosting

BASE = "https://boards-api.greenhouse.io/v1/boards"


def _to_posting(company: str, item: dict) -> JobPosting | None:
    """Greenhouse job 항목 → JobPosting. id 없으면 None."""
    job_id = item.get("id")
    if not job_id:
        return None
    # Greenhouse 의 content 는 HTML 이 **엔티티 인코딩**돼 옴(&lt;p&gt;...&lt;/p&gt;).
    # 한 번 디코딩해 진짜 HTML 로 만든 뒤 저장해야 transform 의 clean_structured_html
    # (래퍼/속성 정리)·html_strip(평문화)이 정상 동작한다. 미디코딩 시 본문이 이스케이프된
    # 채 저장돼 화면에 <p> 같은 태그가 글자 그대로 노출되고, 평문엔 태그 노이즈가 섞인다.
    description = html_lib.unescape(item.get("content", "") or "")
    location = (item.get("location") or {}).get("name", "")
    is_remote = "remote" in location.lower()
    # 부서: departments 배열의 첫 항목 (예: "Engineering – Infrastructure").
    departments = item.get("departments") or []
    department = (departments[0].get("name") or "") if departments else ""
    return JobPosting(
        job_id=f"greenhouse:{company}:{job_id}",
        source="greenhouse",
        title=item.get("title", ""),
        company=company.replace("-", " ").title(),
        location=location,
        is_remote=is_remote,
        employment_type="FULLTIME",
        description=description,
        apply_url=item.get("absolute_url", ""),
        # first_published 우선 — updated_at 은 공고 수정만 해도 갱신돼 "최신순"을 왜곡한다.
        posted_at=item.get("first_published") or item.get("updated_at", ""),
        # Greenhouse 만 마감일 필드를 줌 (대부분 null). 문자열/객체 모두 방어적으로.
        closes_at=_parse_deadline(item.get("application_deadline")),
        department=department,
    )


async def fetch(company: str, query: str = "", limit: int = 100) -> list[JobPosting]:
    url = f"{BASE}/{quote(company, safe='')}/jobs"  # company 인코딩 — 경로 탈출/주입 방지
    async with httpx.AsyncClient(timeout=30, headers={"User-Agent": "dev-jobs-mcp/0.1"}) as client:
        # content=true 로 description 도 함께 받음
        resp = await client.get(url, params={"content": "true"})
        if resp.status_code == 404:
            return []
        resp.raise_for_status()
        data = resp.json()

    postings: list[JobPosting] = []
    q_lower = query.lower()

    for item in data.get("jobs", []):
        p = _to_posting(company, item)
        if p is None:
            continue

        if query:
            haystack = f"{p.title} {_strip_html(p.description)}".lower()
            if q_lower not in haystack:
                continue

        postings.append(p)
        if len(postings) >= limit:
            break

    return postings


def _parse_deadline(value) -> str:
    """application_deadline → 날짜 문자열. None/object 모두 방어적으로 처리."""
    if not value:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        # 일부 보드는 {"date": "..."} 형태로 줄 수 있음
        for k in ("date", "deadline", "value"):
            if value.get(k):
                return str(value[k])
    return ""


def _strip_html(html: str) -> str:
    """HTML 태그 제거 (간단 버전, BeautifulSoup 의존성 제거 위해)."""
    import html as html_lib
    text = re.sub(r"<[^>]+>", " ", html)
    text = html_lib.unescape(text)
    return re.sub(r"\s+", " ", text).strip()
