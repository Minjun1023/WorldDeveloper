"""Lever Postings API.

회사별 공식 공개 API. 키 불필요.
https://api.lever.co/v0/postings/{company}?mode=json
"""
from __future__ import annotations
from urllib.parse import quote

import httpx
from ..models import JobPosting
from .greenhouse import _strip_html

BASE = "https://api.lever.co/v0/postings"


async def fetch(company: str, query: str = "", limit: int = 100) -> list[JobPosting]:
    url = f"{BASE}/{quote(company, safe='')}"  # company 인코딩 — 경로 탈출/주입 방지
    async with httpx.AsyncClient(timeout=30, headers={"User-Agent": "dev-jobs-mcp/0.1"}) as client:
        resp = await client.get(url, params={"mode": "json"})
        if resp.status_code == 404:
            return []
        resp.raise_for_status()
        items = resp.json()

    postings: list[JobPosting] = []
    q_lower = query.lower()

    for item in items:
        title = item.get("text", "")
        description = _strip_html(item.get("descriptionPlain") or item.get("description", "") or "")

        if query:
            haystack = f"{title} {description}".lower()
            if q_lower not in haystack:
                continue

        categories = item.get("categories", {}) or {}
        location = categories.get("location", "")
        is_remote = "remote" in location.lower() if location else False

        commitment = categories.get("commitment", "")  # "Full-time" 등
        emp = {
            "full-time": "FULLTIME",
            "part-time": "PARTTIME",
            "contract": "CONTRACTOR",
            "internship": "INTERN",
        }.get(commitment.lower(), "")

        postings.append(JobPosting(
            job_id=f"lever:{company}:{item.get('id')}",
            source="lever",
            title=title,
            company=company.replace("-", " ").title(),
            location=location,
            is_remote=is_remote,
            employment_type=emp,
            description=description,
            apply_url=item.get("hostedUrl", ""),
            posted_at=str(item.get("createdAt", "")),
            tags=[categories.get("team", "")] if categories.get("team") else [],
        ))

        if len(postings) >= limit:
            break

    return postings
