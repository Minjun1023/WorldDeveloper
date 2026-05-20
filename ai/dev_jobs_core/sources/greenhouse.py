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
        ))

        if len(postings) >= limit:
            break

    return postings


def _strip_html(html: str) -> str:
    """HTML 태그 제거 (간단 버전, BeautifulSoup 의존성 제거 위해)."""
    import html as html_lib
    text = re.sub(r"<[^>]+>", " ", html)
    text = html_lib.unescape(text)
    return re.sub(r"\s+", " ", text).strip()
