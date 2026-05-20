"""Arbeitnow 공개 API (https://www.arbeitnow.com/api/job-board-api).

유럽/원격 개발자 공고 중심. 키 불필요. 페이지네이션 지원.
"""
from __future__ import annotations
import httpx
from ..models import JobPosting

API_URL = "https://www.arbeitnow.com/api/job-board-api"


async def fetch(query: str = "", limit: int = 50, max_pages: int = 3) -> list[JobPosting]:
    postings: list[JobPosting] = []
    q_tokens = [t for t in query.lower().split() if t]

    async with httpx.AsyncClient(timeout=30, headers={"User-Agent": "dev-jobs-mcp/0.1"}) as client:
        for page in range(1, max_pages + 1):
            resp = await client.get(API_URL, params={"page": page})
            resp.raise_for_status()
            data = resp.json()

            items = data.get("data", [])
            if not items:
                break

            for item in items:
                title = item.get("title", "")
                description = item.get("description", "") or ""
                tags = item.get("tags", []) or []

                # 쿼리 필터링: 모든 토큰이 어딘가에 등장 (AND 매칭)
                if q_tokens:
                    haystack = f"{title} {' '.join(tags)} {description}".lower()
                    if not all(tok in haystack for tok in q_tokens):
                        continue

                slug = item.get("slug", "")
                if not slug:
                    continue

                postings.append(JobPosting(
                    job_id=f"arbeitnow:{slug}",
                    source="arbeitnow",
                    title=title,
                    company=item.get("company_name", ""),
                    location=item.get("location", ""),
                    is_remote=bool(item.get("remote")),
                    employment_type=_normalize_emp(item.get("job_types", [])),
                    description=description,
                    apply_url=item.get("url", ""),
                    posted_at=str(item.get("created_at", "")),
                    tags=[str(t) for t in tags],
                ))

                if len(postings) >= limit:
                    return postings

    return postings


def _normalize_emp(types: list) -> str:
    if not types:
        return ""
    t = str(types[0]).lower()
    mapping = {
        "full-time": "FULLTIME",
        "part-time": "PARTTIME",
        "contract": "CONTRACTOR",
        "internship": "INTERN",
    }
    return mapping.get(t, t.upper())
