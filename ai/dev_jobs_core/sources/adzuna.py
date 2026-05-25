"""Adzuna API (무료, app_id/app_key 등록). 국가별 IT/개발 공고 수집.

ADZUNA_APP_ID / ADZUNA_APP_KEY 가 설정된 경우만 활성화(없으면 빈 리스트).
"""
from __future__ import annotations

import os

import httpx

from ..models import JobPosting

BASE = "https://api.adzuna.com/v1/api/jobs"


def is_enabled() -> bool:
    return bool(os.getenv("ADZUNA_APP_ID") and os.getenv("ADZUNA_APP_KEY"))


def _to_int(v) -> int | None:
    try:
        return int(float(v)) if v is not None else None
    except (TypeError, ValueError):
        return None


def _parse_results(country: str, payload: dict) -> list[JobPosting]:
    out: list[JobPosting] = []
    for item in payload.get("results", []) or []:
        jid = item.get("id")
        if not jid:
            continue
        title = item.get("title", "") or ""
        location = (item.get("location") or {}).get("display_name", "") or ""
        out.append(JobPosting(
            job_id=f"adzuna:{country}:{jid}",
            source="adzuna",
            title=title,
            company=(item.get("company") or {}).get("display_name", "") or "",
            location=location,
            is_remote="remote" in f"{title} {location}".lower(),
            description=item.get("description", "") or "",
            apply_url=item.get("redirect_url", "") or "",
            posted_at=str(item.get("created", "") or ""),
            salary_min=_to_int(item.get("salary_min")),
            salary_max=_to_int(item.get("salary_max")),
        ))
    return out


async def fetch(countries: list[str], query: str = "developer", per_country: int = 50,
                max_pages: int = 1, max_days_old: int = 45) -> list[JobPosting]:
    if not is_enabled():
        return []
    app_id = os.getenv("ADZUNA_APP_ID", "")
    app_key = os.getenv("ADZUNA_APP_KEY", "")
    postings: list[JobPosting] = []
    async with httpx.AsyncClient(timeout=30, headers={"User-Agent": "dev-jobs/0.1"}) as client:
        for country in countries:
            for page in range(1, max_pages + 1):
                params = {
                    "app_id": app_id,
                    "app_key": app_key,
                    "what": query,
                    "category": "it-jobs",
                    "results_per_page": min(per_country, 50),
                    "max_days_old": max_days_old,
                    "content-type": "application/json",
                }
                try:
                    resp = await client.get(f"{BASE}/{country}/search/{page}", params=params)
                    resp.raise_for_status()
                    postings.extend(_parse_results(country, resp.json()))
                except Exception:
                    break  # 이 국가 실패 → 다음 국가
    return postings
