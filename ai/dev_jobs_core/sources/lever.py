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


def _compose_description(item: dict) -> str:
    """Lever 공고 본문을 섹션 구조 그대로 조립.

    Lever 의 ``description`` 필드는 **도입부(opening)** 만 담는다. 실제 본문은
    ``lists``(섹션 배열: {text=제목, content=HTML})와 ``additional``(마무리)에
    분리돼 있어, 이전엔 ``description`` 만 저장해 본문 대부분이 누락됐다.
    여기서 도입부 + 각 섹션(``<h3>제목</h3>`` + 내용) + 마무리를 합쳐 전체
    본문을 복원한다. 평문화/클린(래퍼·속성 제거)은 transform 단계가 담당.
    """
    parts: list[str] = []

    intro = item.get("description") or item.get("opening") or ""
    if intro:
        parts.append(intro)

    for sec in item.get("lists") or []:
        content = sec.get("content") or ""
        if not content.strip():
            continue
        # 일부 섹션은 <ul> 없이 맨 <li> 만 옴 → 불릿이 안 보이므로 <ul> 로 감싼다.
        low = content.lower()
        if "<li" in low and "<ul" not in low and "<ol" not in low:
            content = f"<ul>{content}</ul>"
        title = (sec.get("text") or "").strip()
        head = f"<h3>{title}</h3>" if title else ""
        parts.append(f"{head}{content}")

    additional = item.get("additional") or ""
    if additional:
        parts.append(additional)

    if parts:
        return "".join(parts)
    # 구조화 필드가 전혀 없으면 평문 폴백.
    return item.get("descriptionPlain", "") or ""


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
        # 구조 보존: 도입부 + lists(섹션) + 마무리를 합쳐 전체 본문 복원. 클린은 transform 에서.
        description = _compose_description(item)

        if query:
            haystack = f"{title} {_strip_html(description)}".lower()
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
            # 기술 스택은 transform 의 extract_tech 가 description 에서 추출.
            # Lever 의 team(예: "Music")은 기술 스택이 아니므로 tags 에 넣지 않는다.
            tags=[],
        ))

        if len(postings) >= limit:
            break

    return postings
