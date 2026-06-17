"""JSearch API (RapidAPI) - 선택적 보강 소스.

RAPIDAPI_KEY 환경변수가 설정된 경우만 활성화된다.
LinkedIn/Indeed/Glassdoor 등 메이저 사이트 커버.
"""
from __future__ import annotations

import os

import httpx

from ..models import JobPosting

API_KEY = os.getenv("RAPIDAPI_KEY")
BASE = "https://jsearch.p.rapidapi.com"


def is_enabled() -> bool:
    return bool(API_KEY)


async def fetch(query: str, location: str = "", remote_only: bool = False, limit: int = 30) -> list[JobPosting]:
    if not API_KEY:
        return []

    full_query = f"{query} in {location}" if location else query
    params: dict[str, str] = {
        "query": full_query,
        "page": "1",
        "num_pages": "1",
        "date_posted": "month",
    }
    if remote_only:
        params["remote_jobs_only"] = "true"

    headers = {
        "X-RapidAPI-Key": API_KEY,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(f"{BASE}/search", headers=headers, params=params)
        resp.raise_for_status()
        data = resp.json()

    postings: list[JobPosting] = []
    for job in data.get("data", [])[:limit]:
        postings.append(JobPosting(
            job_id=f"jsearch:{job.get('job_id', '')}",
            source="jsearch",
            title=job.get("job_title", ""),
            company=job.get("employer_name", ""),
            location=", ".join(filter(None, [
                job.get("job_city"),
                job.get("job_state"),
                job.get("job_country"),
            ])),
            is_remote=bool(job.get("job_is_remote")),
            employment_type=job.get("job_employment_type", ""),
            description=job.get("job_description", "") or "",
            apply_url=job.get("job_apply_link", ""),
            posted_at=job.get("job_posted_at_datetime_utc", ""),
            tags=job.get("job_required_skills") or [],
            salary_min=job.get("job_min_salary"),
            salary_max=job.get("job_max_salary"),
            salary_currency=job.get("job_salary_currency", ""),
            salary_period=job.get("job_salary_period", ""),
        ))

    return postings
