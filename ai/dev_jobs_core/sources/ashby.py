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
        description = _strip_html(item.get("descriptionHtml") or item.get("description", "") or "")

        if query:
            haystack = f"{title} {description}".lower()
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

        # Ashby 의 compensation 구조: {compensationTierSummary, compensationTiers}
        comp = item.get("compensation") or {}
        comp_tiers = comp.get("compensationTiers") or []
        salary_min, salary_max, currency = None, None, ""
        if comp_tiers:
            tier = comp_tiers[0]
            tier_components = tier.get("components") or []
            for c in tier_components:
                if c.get("compensationType") == "Salary":
                    val = c.get("value") or {}
                    salary_min = val.get("minValue")
                    salary_max = val.get("maxValue")
                    currency = val.get("currencyCode", "")
                    break

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
            salary_period="YEAR" if salary_min else "",
            # 기술 스택은 transform 의 extract_tech 가 추출. department 는 스택이 아니므로 제외.
            tags=[],
        ))

        if len(postings) >= limit:
            break

    return postings
