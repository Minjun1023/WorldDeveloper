"""Personio 공개 채용 피드(무료, 키 불필요). 회사별 공고 수집.

피드: https://{token}.jobs.personio.com/xml
루트 <workzag-jobs> / 자식 <position> 반복. 본문은 <jobDescriptions> 안
<jobDescription><value> 블록에 인라인으로 들어 있어 상세 콜이 필요 없다.

주의: 존재하지 않는 서브도메인은 personio.com 으로 307 리다이렉트되므로,
회사 토큰은 사전에 개별 검증해야 한다.
"""
from __future__ import annotations

import xml.etree.ElementTree as ET

import httpx

from ..models import JobPosting


def _parse_positions(xml_text: str) -> list[ET.Element]:
    """<position> 요소들을 리스트로. 파싱 실패/빈 입력 → []."""
    if not xml_text or not xml_text.strip():
        return []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return []
    return list(root.findall("position"))


def _text(pos, tag: str) -> str:
    el = pos.find(tag)
    return (el.text or "").strip() if el is not None else ""


def _location(pos) -> str:
    offices = []
    main = _text(pos, "office")
    if main:
        offices.append(main)
    extra = pos.find("additionalOffices")
    if extra is not None:
        for o in extra.findall("office"):
            t = (o.text or "").strip()
            if t:
                offices.append(t)
    return ", ".join(offices)


def _description(pos) -> str:
    descs = pos.find("jobDescriptions")
    if descs is None:
        return ""
    parts = []
    for jd in descs.findall("jobDescription"):
        v = jd.find("value")
        if v is not None and v.text:
            parts.append(v.text.strip())
    return "\n".join(parts)


def _to_posting(token: str, pos) -> JobPosting | None:
    jid = _text(pos, "id")
    if not jid:
        return None
    return JobPosting(
        job_id=f"personio:{token}:{jid}",
        source="personio",
        title=_text(pos, "name"),
        company=_text(pos, "subcompany") or token,
        location=_location(pos),
        is_remote=False,
        employment_type=_text(pos, "employmentType"),
        description=_description(pos),
        apply_url=f"https://{token}.jobs.personio.com/job/{jid}",
        posted_at=_text(pos, "createdAt"),
    )


async def fetch(token: str, limit: int = 20) -> list[JobPosting]:
    async with httpx.AsyncClient(
        timeout=30, headers={"User-Agent": "dev-jobs/0.1"}, follow_redirects=False
    ) as client:
        resp = await client.get(f"https://{token}.jobs.personio.com/xml")
        resp.raise_for_status()
        positions = _parse_positions(resp.text)[:limit]
    postings = [_to_posting(token, p) for p in positions]
    return [p for p in postings if p is not None]
