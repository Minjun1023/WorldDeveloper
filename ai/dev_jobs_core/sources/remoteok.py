"""RemoteOK 공개 JSON API (https://remoteok.com/api).

키 불필요. 첫 항목은 메타데이터이므로 건너뛴다.
"""
from __future__ import annotations
import httpx
from ..models import JobPosting

API_URL = "https://remoteok.com/api"


async def fetch(query: str = "", limit: int = 50) -> list[JobPosting]:
    async with httpx.AsyncClient(timeout=30, headers={"User-Agent": "dev-jobs-mcp/0.1"}) as client:
        resp = await client.get(API_URL)
        resp.raise_for_status()
        raw = resp.json()

    # 첫 항목은 metadata (legal 정보), 나머지가 실제 공고
    postings: list[JobPosting] = []
    q_tokens = [t for t in query.lower().split() if t]

    for item in raw[1:]:
        if not isinstance(item, dict):
            continue

        title = item.get("position", "") or item.get("title", "")
        description = item.get("description", "") or ""
        tags = item.get("tags", []) or []

        # 쿼리 필터링: 모든 토큰이 제목/태그/description 어딘가에 등장해야 함 (AND 매칭)
        if q_tokens:
            haystack = f"{title} {' '.join(tags)} {description}".lower()
            if not all(tok in haystack for tok in q_tokens):
                continue

        job_id_native = str(item.get("id", item.get("slug", "")))
        if not job_id_native:
            continue

        postings.append(JobPosting(
            job_id=f"remoteok:{job_id_native}",
            source="remoteok",
            title=title,
            company=item.get("company", ""),
            location=item.get("location", "Remote"),
            is_remote=True,  # RemoteOK 는 전부 원격
            employment_type="FULLTIME",
            description=description,
            apply_url=item.get("apply_url") or item.get("url", ""),
            posted_at=item.get("date", ""),
            tags=[str(t) for t in tags],
            salary_min=item.get("salary_min"),
            salary_max=item.get("salary_max"),
            salary_currency="USD",
            salary_period="YEAR",
        ))

        if len(postings) >= limit:
            break

    return postings
