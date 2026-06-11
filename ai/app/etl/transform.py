"""JobPosting → Postgres row 변환.

비자 분류 / salary USD 정규화 / 기술스택 추출 / HTML strip / 임베딩 / 회사 slug 정규화.
"""
from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Any

from dev_jobs_core.analyzers.remote_geo import classify_remote_eligibility
from dev_jobs_core.analyzers.salary import _to_usd_year, extract_salary_from_description
from dev_jobs_core.analyzers.stack import extract_tech
from dev_jobs_core.analyzers.visa import classify_visa
from dev_jobs_core.models import JobPosting
from dev_jobs_core.recommender.embeddings import embed_text
from dev_jobs_core.registry import resolve as resolve_company


def slugify(name: str) -> str:
    s = (name or "").lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "unknown"


# 근무형태만 적힌(도시·국가 없는) generic location. 회사 HQ 가 알려진 경우 이걸로 보정한다.
_GENERIC_LOC = {
    "remote", "hybrid", "onsite", "on-site", "on site", "anywhere", "worldwide",
    "global", "flexible", "remote/hybrid", "hybrid/remote", "fully remote",
    "remote - anywhere", "in office", "in-office", "office",
}


def _enrich_location(loc: str | None, hq: str | None) -> str | None:
    """location 이 근무형태만 있는 generic 값이고 회사 HQ 가 있으면 HQ 로 지역을 보정.
    실제 도시/국가가 있으면 그대로 둔다(예: 'Hybrid-Palo Alto, CA' 는 미국 유지).
    """
    if not hq:
        return loc
    norm = re.sub(r"\s+", " ", (loc or "").strip().lower())
    if not norm or norm in _GENERIC_LOC:
        original = (loc or "").strip()
        return f"{hq} ({original})" if original else hq
    return loc


def html_strip(html: str) -> str:
    text = re.sub(r"<[^>]+>", " ", html or "")
    return re.sub(r"\s+", " ", text).strip()


def parse_dt(s: str) -> datetime | None:
    if not s:
        return None
    s = str(s).strip()
    if s.isdigit():  # unix epoch (Arbeitnow)
        try:
            return datetime.fromtimestamp(int(s), tz=UTC)
        except (ValueError, OverflowError):
            return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None


def _usd(amount: int | None, currency: str, period: str) -> int | None:
    if not amount or amount <= 0:
        return None
    v = _to_usd_year(amount, currency, period)
    return int(v) if v else None


def transform(j: JobPosting) -> tuple[dict[str, Any], dict[str, Any]]:
    """(company_row, job_row) 반환. job_row.company_slug 가 company_row.slug 와 일치."""
    info = resolve_company(j.company)
    if info:
        slug = info["token"]
        ats = info.get("ats")
        ats_token = info["token"]
        ctags = info.get("tags", []) or []
        hq = info.get("hq")
    else:
        slug = slugify(j.company)
        ats = None
        ats_token = None
        ctags = []
        hq = None

    company_row = {
        "slug": slug,
        "display_name": j.company or slug,
        "ats": ats,
        "ats_token": ats_token,
        "tags": ctags,
    }

    status, evidence = classify_visa(j.description)
    remote_status, remote_evidence = classify_remote_eligibility(
        j.location or "", bool(j.is_remote), j.description or "", title=j.title or ""
    )
    plain = html_strip(j.description)
    tags = j.tags or extract_tech(j.description)
    embedding = embed_text(f"{j.title}\n{plain}")

    # 구조화 연봉이 없으면 본문에서 명시 범위 추출(원본 통화 표시 + USD 환산 점수용).
    raw_min, raw_max = j.salary_min, j.salary_max
    raw_cur, raw_period = j.salary_currency, j.salary_period
    if raw_min is None and raw_max is None:
        ext = extract_salary_from_description(j.description)
        if ext:
            raw_min, raw_max = ext["min"], ext["max"]
            raw_cur, raw_period = ext["currency"], ext["period"]

    job_row = {
        "id": j.job_id,
        "source": j.source,
        "title": j.title,
        "company_slug": slug,
        "location": _enrich_location(j.location, hq),
        "is_remote": bool(j.is_remote),
        "employment_type": j.employment_type or None,
        "description": j.description or None,
        "description_text": plain or None,
        "apply_url": j.apply_url or None,
        "posted_at": parse_dt(j.posted_at),
        "closes_at": parse_dt(j.closes_at),
        "tags": tags,
        "salary_min": raw_min,
        "salary_max": raw_max,
        "salary_currency": raw_cur or None,
        "salary_period": raw_period or None,
        "salary_min_usd": _usd(raw_min, raw_cur, raw_period),
        "salary_max_usd": _usd(raw_max, raw_cur, raw_period),
        "visa_status": status,
        "visa_evidence": evidence,
        "remote_eligibility": remote_status,
        "remote_evidence": remote_evidence,
        "embedding": embedding,
    }
    return company_row, job_row
