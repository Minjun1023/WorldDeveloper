"""JobPosting → Postgres row 변환.

비자 분류 / salary USD 정규화 / 기술스택 추출 / HTML strip / 임베딩 / 회사 slug 정규화.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

from dev_jobs_core.analyzers.salary import _to_usd_year
from dev_jobs_core.analyzers.stack import extract_tech
from dev_jobs_core.analyzers.visa import classify_visa
from dev_jobs_core.models import JobPosting
from dev_jobs_core.recommender.embeddings import embed_text
from dev_jobs_core.registry import resolve as resolve_company


def slugify(name: str) -> str:
    s = (name or "").lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "unknown"


def html_strip(html: str) -> str:
    text = re.sub(r"<[^>]+>", " ", html or "")
    return re.sub(r"\s+", " ", text).strip()


def parse_dt(s: str) -> datetime | None:
    if not s:
        return None
    s = str(s).strip()
    if s.isdigit():  # unix epoch (Arbeitnow)
        try:
            return datetime.fromtimestamp(int(s), tz=timezone.utc)
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
    else:
        slug = slugify(j.company)
        ats = None
        ats_token = None
        ctags = []

    company_row = {
        "slug": slug,
        "display_name": j.company or slug,
        "ats": ats,
        "ats_token": ats_token,
        "tags": ctags,
    }

    status, evidence = classify_visa(j.description)
    plain = html_strip(j.description)
    tags = j.tags or extract_tech(j.description)
    embedding = embed_text(f"{j.title}\n{plain}")

    job_row = {
        "id": j.job_id,
        "source": j.source,
        "title": j.title,
        "company_slug": slug,
        "location": j.location or None,
        "is_remote": bool(j.is_remote),
        "employment_type": j.employment_type or None,
        "description": j.description or None,
        "description_text": plain or None,
        "apply_url": j.apply_url or None,
        "posted_at": parse_dt(j.posted_at),
        "tags": tags,
        "salary_min_usd": _usd(j.salary_min, j.salary_currency, j.salary_period),
        "salary_max_usd": _usd(j.salary_max, j.salary_currency, j.salary_period),
        "visa_status": status,
        "visa_evidence": evidence,
        "embedding": embedding,
    }
    return company_row, job_row
