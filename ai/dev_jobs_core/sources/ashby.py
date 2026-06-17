"""Ashby Posting API.

회사별 공식 공개 API. 키 불필요.
https://api.ashbyhq.com/posting-api/job-board/{org}?includeCompensation=true

Linear, Vercel, Posthog, Ramp, Supabase 등 신생 유니콘 다수가 사용.
"""
from __future__ import annotations

import httpx

from ..models import JobPosting
from .greenhouse import _strip_html

BASE = "https://api.ashbyhq.com/posting-api/job-board"

# Ashby interval("1 YEAR" 등) → JobPosting.salary_period
_INTERVAL_PERIOD = {"YEAR": "YEAR", "MONTH": "MONTH", "HOUR": "HOUR", "WEEK": "WEEK", "DAY": "DAY"}


def _salary_from_comp(comp: dict) -> tuple[int | None, int | None, str, str]:
    """Ashby compensation → (salary_min, salary_max, currency, period).

    minValue/maxValue/currencyCode/interval 는 component 에 '직접' 들어있다
    (중첩 'value' 키가 아님 — 과거 버그). compensationTiers[0].components 우선,
    없으면 summaryComponents 폴백. 'Salary' 타입만 사용.
    """
    comp = comp or {}
    tiers = comp.get("compensationTiers") or []
    components = (tiers[0].get("components") if tiers else None) or comp.get("summaryComponents") or []
    for c in components:
        if c.get("compensationType") == "Salary" and c.get("minValue") is not None:
            parts = (c.get("interval") or "").split()
            period = _INTERVAL_PERIOD.get(parts[-1].upper(), "YEAR") if parts else "YEAR"
            return c.get("minValue"), c.get("maxValue"), c.get("currencyCode") or "", period
    return None, None, "", ""


async def fetch(company: str, query: str = "", limit: int = 100) -> list[JobPosting]:
    url = f"{BASE}/{company}"
    async with httpx.AsyncClient(timeout=30, headers={"User-Agent": "dev-jobs-mcp/0.2"}) as client:
        resp = await client.get(url, params={"includeCompensation": "true"})
        if resp.status_code == 404:
            return []
        resp.raise_for_status()
        data = resp.json()

    postings: list[JobPosting] = []
    q_lower = query.lower()

    for item in data.get("jobs", []):
        title = item.get("title", "")
        # 구조 보존: descriptionHtml(원본 HTML) 그대로 전달. 평문화/클린은 transform 에서.
        description = item.get("descriptionHtml") or item.get("description", "") or ""

        if query:
            haystack = f"{title} {_strip_html(description)}".lower()
            if q_lower not in haystack:
                continue

        location = item.get("locationName", "") or item.get("location", "")
        is_remote = bool(item.get("isRemote")) or "remote" in location.lower()
        emp_type = (item.get("employmentType") or "").upper()
        emp_mapping = {
            "FULL_TIME": "FULLTIME",
            "FULLTIME": "FULLTIME",
            "PART_TIME": "PARTTIME",
            "CONTRACT": "CONTRACTOR",
            "INTERNSHIP": "INTERN",
        }
        emp = emp_mapping.get(emp_type, emp_type)

        salary_min, salary_max, currency, salary_period = _salary_from_comp(
            item.get("compensation") or {})

        postings.append(JobPosting(
            job_id=f"ashby:{company}:{item.get('id')}",
            source="ashby",
            title=title,
            company=company.replace("-", " ").title(),
            location=location,
            is_remote=is_remote,
            employment_type=emp,
            description=description,
            apply_url=item.get("jobUrl") or item.get("applyUrl", ""),
            posted_at=str(item.get("publishedAt", "")),
            salary_min=salary_min,
            salary_max=salary_max,
            salary_currency=currency,
            salary_period=salary_period,
            # 기술 스택은 transform 의 extract_tech 가 추출. department 는 스택이 아니므로 제외.
            tags=[],
        ))

        if len(postings) >= limit:
            break

    return postings
