"""WeWorkRemotely RSS (무료, 키 불필요) — 원격 프로그래밍 공고."""
from __future__ import annotations

import xml.etree.ElementTree as ET

import httpx

from ..models import JobPosting

RSS_URL = "https://weworkremotely.com/categories/remote-programming-jobs.rss"


def _native_id(guid: str) -> str:
    """guid(보통 전체 URL https://weworkremotely.com/remote-jobs/{slug})에서
    path segment 로 안전한 slug 만 native id 로 추출한다.
    job_id 는 /api/v1/jobs/{id} 의 단일 segment 로 쓰이므로 슬래시가 있으면 안 된다."""
    return guid.rstrip("/").rsplit("/", 1)[-1] or guid


def _parse_rss(xml_text: str) -> list[JobPosting]:
    out: list[JobPosting] = []
    root = ET.fromstring(xml_text)
    for item in root.iter("item"):
        link = (item.findtext("link") or "").strip()
        if not link:
            continue
        raw_title = (item.findtext("title") or "").strip()  # 보통 "Company: Title"
        if ":" in raw_title:
            company, _, title = raw_title.partition(":")
            company, title = company.strip(), title.strip()
        else:
            company, title = "", raw_title
        guid = (item.findtext("guid") or link).strip()
        out.append(JobPosting(
            job_id=f"wwr:{_native_id(guid)}",
            source="wwr",
            title=title,
            company=company,
            location="Remote",
            is_remote=True,
            description=(item.findtext("description") or "").strip(),
            apply_url=link,
            posted_at=(item.findtext("pubDate") or "").strip(),
        ))
    return out


async def fetch(query: str = "", limit: int = 100) -> list[JobPosting]:
    async with httpx.AsyncClient(timeout=30, headers={"User-Agent": "dev-jobs/0.1"}) as client:
        resp = await client.get(RSS_URL)
        resp.raise_for_status()
        postings = _parse_rss(resp.text)
    return postings[:limit]
