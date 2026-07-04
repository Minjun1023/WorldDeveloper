"""SmartRecruiters 공개 Posting API (무료, 키 불필요). 회사별 공고 수집.

목록 응답엔 설명·사용자 apply URL 이 없어, 공고당 상세 1콜로 보강한다.
"""
from __future__ import annotations

import httpx

from ..models import JobPosting

BASE = "https://api.smartrecruiters.com/v1/companies"


def _parse_list(payload: dict) -> list[dict]:
    return payload.get("content", []) or []


def _section_text(detail: dict, key: str) -> str:
    sections = (detail.get("jobAd") or {}).get("sections") or {}
    return (sections.get(key) or {}).get("text") or ""


def _to_posting(token: str, item: dict, detail: dict | None) -> JobPosting | None:
    jid = item.get("id")
    if not jid:
        return None
    detail = detail or {}
    loc = item.get("location") or {}
    location = loc.get("fullLocation") or " ".join(
        x for x in [loc.get("city"), loc.get("country")] if x
    )
    description = "\n".join(
        t for t in [_section_text(detail, "jobDescription"),
                    _section_text(detail, "qualifications")] if t
    )
    apply_url = (detail.get("applyUrl") or detail.get("postingUrl")
                 or f"https://jobs.smartrecruiters.com/{token}/{jid}")
    return JobPosting(
        job_id=f"smartrecruiters:{token}:{jid}",
        source="smartrecruiters",
        title=item.get("name", "") or "",
        company=(item.get("company") or {}).get("name", "") or token,
        location=location,
        is_remote=bool(loc.get("remote")),
        employment_type=(item.get("typeOfEmployment") or {}).get("label", "") or "",
        description=description,
        apply_url=apply_url,
        posted_at=str(item.get("releasedDate", "") or ""),
        # function(직군 분류, 예: "Software Engineering") — 부서 정보로 활용.
        department=(item.get("function") or {}).get("label", "") or "",
    )


async def fetch(token: str, limit: int = 20) -> list[JobPosting]:
    postings: list[JobPosting] = []
    async with httpx.AsyncClient(timeout=30, headers={"User-Agent": "dev-jobs/0.1"}) as client:
        resp = await client.get(f"{BASE}/{token}/postings",
                                params={"limit": limit, "offset": 0})
        resp.raise_for_status()
        items = _parse_list(resp.json())[:limit]
        for item in items:
            jid = item.get("id")
            detail = None
            if jid:
                try:
                    dr = await client.get(f"{BASE}/{token}/postings/{jid}")
                    dr.raise_for_status()
                    detail = dr.json()
                except Exception:
                    detail = None
            p = _to_posting(token, item, detail)
            if p:
                postings.append(p)
    return postings
