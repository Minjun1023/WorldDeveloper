"""Workable 공개 채용 위젯 API. 키 불필요.

https://apply.workable.com/api/v1/widget/accounts/{account}?details=true
`account` 은 회사의 Workable 서브도메인(예: doist, hotjar).
회사가 Workable 을 ATS 로 쓰고 공개 공고가 있을 때만 동작한다.
"""
from __future__ import annotations

import re

import httpx

from ..models import JobPosting

BASE = "https://apply.workable.com/api/v1/widget/accounts"

_EMP = {"full": "FULLTIME", "part": "PARTTIME", "contract": "CONTRACTOR",
        "temporary": "TEMPORARY", "internship": "INTERN"}


async def fetch(company: str, query: str = "", limit: int = 100) -> list[JobPosting]:
    url = f"{BASE}/{company}"
    async with httpx.AsyncClient(timeout=30, headers={"User-Agent": "dev-jobs-mcp/0.1"}) as client:
        resp = await client.get(url, params={"details": "true"})
        # 404=계정 없음, 429=레이트리밋(Workable 은 잦음). 둘 다 이번 사이클 스킵(다음에 재시도).
        if resp.status_code in (404, 429):
            return []
        resp.raise_for_status()
        data = resp.json()

    display = (data.get("name") or company.replace("-", " ").title()).strip()
    postings: list[JobPosting] = []
    q_lower = query.lower()

    for item in data.get("jobs", []):
        p = _to_posting(company, display, item)
        if p is None:
            continue
        if query and q_lower not in f"{p.title} {p.description}".lower():
            continue
        postings.append(p)
        if len(postings) >= limit:
            break

    return postings


def _to_posting(company: str, display: str, item: dict) -> JobPosting | None:
    """위젯 job dict → JobPosting (순수 함수, 네트워크 없음). id 없으면 None."""
    sid = item.get("shortcode") or item.get("code") or item.get("id")
    if not sid:
        return None
    location = _location(item)
    return JobPosting(
        job_id=f"workable:{company}:{sid}",
        source="workable",
        title=item.get("title", ""),
        company=display,
        location=location,
        is_remote=bool(item.get("telecommuting")) or "remote" in location.lower(),
        employment_type=_EMP.get((item.get("employment_type") or "").lower(), "FULLTIME"),
        description=_strip_html(item.get("description", "") or ""),
        apply_url=item.get("application_url") or item.get("url") or item.get("shortlink", ""),
        posted_at=item.get("published_on") or item.get("created_at", ""),
        closes_at="",
    )


def _location(item: dict) -> str:
    """city/state/country 조합. 없으면 locations 첫 항목 또는 빈 문자열."""
    parts = [item.get("city"), item.get("state"), item.get("country")]
    loc = ", ".join(p for p in parts if p)
    if loc:
        return loc
    locs = item.get("locations") or []
    if locs and isinstance(locs[0], dict):
        p = [locs[0].get("city"), locs[0].get("region"), locs[0].get("country")]
        return ", ".join(x for x in p if x)
    return ""


def _strip_html(html: str) -> str:
    import html as html_lib
    text = re.sub(r"<[^>]+>", " ", html)
    return re.sub(r"\s+", " ", html_lib.unescape(text)).strip()
