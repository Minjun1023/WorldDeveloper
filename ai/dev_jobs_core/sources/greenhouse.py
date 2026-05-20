"""Greenhouse Job Board API.

회사별 공식 공개 API. 키 불필요.
https://boards-api.greenhouse.io/v1/boards/{company}/jobs?content=true

`company` 는 회사의 greenhouse board token (예: stripe, airbnb, notion).
회사가 Greenhouse 를 ATS 로 쓰는 경우에만 동작한다.
"""
from __future__ import annotations
import re
import httpx
from ..models import JobPosting

BASE = "https://boards-api.greenhouse.io/v1/boards"


async def fetch(company: str, query: str = "", limit: int = 100) -> list[JobPosting]:
    url = f"{BASE}/{company}/jobs"
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
        title = item.get("title", "")
        # description 은 HTML 이므로 태그 제거
        description_html = item.get("content", "") or ""
        description = _strip_html(description_html)

        if query:
            haystack = f"{title} {description}".lower()
            if q_lower not in haystack:
                continue

        location = (item.get("location") or {}).get("name", "")
        is_remote = "remote" in location.lower()

        postings.append(JobPosting(
            job_id=f"greenhouse:{company}:{item.get('id')}",
            source="greenhouse",
            title=title,
            company=company.replace("-", " ").title(),
            location=location,
            is_remote=is_remote,
            employment_type="FULLTIME",
            description=description,
            apply_url=item.get("absolute_url", ""),
            posted_at=item.get("updated_at", ""),
            # Greenhouse 만 마감일 필드를 줌 (대부분 null). 문자열/객체 모두 방어적으로.
            closes_at=_parse_deadline(item.get("application_deadline")),
        ))

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
