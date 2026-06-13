"""JobPosting → Postgres row 변환.

비자 분류 / salary USD 정규화 / 기술스택 추출 / HTML strip / 임베딩 / 회사 slug 정규화.
"""
from __future__ import annotations

import html as html_lib
import re
from datetime import UTC, datetime
from typing import Any

from dev_jobs_core.analyzers.experience import extract_experience_years
from dev_jobs_core.analyzers.remote_geo import classify_remote_eligibility
from dev_jobs_core.analyzers.salary import _to_usd_year, extract_salary_from_description
from dev_jobs_core.analyzers.seniority import extract_seniority
from dev_jobs_core.analyzers.stack import extract_tech, normalize_tech_tags
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
    text = html_lib.unescape(text)   # &mdash; &nbsp; &amp; 등 디코드
    return re.sub(r"\s+", " ", text).strip()


# 표시용 본문: 원문 구조(문단·제목·불릿)는 살리고 래퍼/속성/잡태그만 제거. 평문화(html_strip)와 달리
# 의미 태그를 보존해 .job-desc 가 깔끔히 렌더하도록. BeautifulSoup 없이 정규식(커넥터와 동일 정책).
_ALLOWED_TAGS = {"p", "ul", "ol", "li", "strong", "b", "em", "i", "h1", "h2", "h3", "h4", "a", "br"}
# 본문과 무관한 반복 문구(EEO·개인정보·지원 안내 등) 문단 제거 — 보수적(키워드 명확한 것만).
_BOILERPLATE = re.compile(
    r"(equal opportunity|reasonable accommodation|privacy policy|committed to inclusion"
    r"|applicant and candidate|apply for this job|click here to apply)",
    re.I,
)


def clean_structured_html(html: str) -> str:
    if not html:
        return ""
    h = html
    h = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", "", h)               # script/style 제거
    h = re.sub(r"(?i)</?(div|span|section|article|figure|table|tbody|thead|tr|td|th)[^>]*>", "", h)  # 래퍼 언랩
    h = re.sub(r"(?i)<([a-z0-9]+)\b[^>]*>",
               lambda m: f"<{m.group(1).lower()}>" if m.group(1).lower() in _ALLOWED_TAGS else "", h)  # 허용 여는태그(속성 제거)
    h = re.sub(r"(?i)</([a-z0-9]+)\s*>",
               lambda m: f"</{m.group(1).lower()}>" if m.group(1).lower() in _ALLOWED_TAGS else "", h)  # 허용 닫는태그
    h = re.sub(r"(?is)<p>(.*?)</p>",
               lambda m: "" if _BOILERPLATE.search(re.sub(r"<[^>]+>", "", m.group(1))) else m.group(0), h)  # 보일러플레이트 문단
    h = re.sub(r"(?i)<(p|li|ul|ol)>\s*</\1>", "", h)                        # 빈 요소 제거
    h = re.sub(r"[ \t]*\n[ \t]*", "\n", h)
    h = re.sub(r"\n{3,}", "\n\n", h)
    return h.strip()


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

    # 분석(비자/원격/기술/연봉/임베딩)은 평문(plain)으로 — j.description 이 HTML 일 수 있어 태그 오염 방지
    # (비자 evidence 문장에 태그가 섞이던 문제도 함께 해소). 표시용은 아래서 구조 보존 HTML 로 저장.
    plain = html_strip(j.description)
    status, evidence = classify_visa(plain)
    remote_status, remote_evidence = classify_remote_eligibility(
        j.location or "", bool(j.is_remote), plain, title=j.title or ""
    )
    # 보드 태그(arbeitnow/remoteok 등)는 비기술 라벨이 섞여 들어오므로 기술스택만 정규화.
    # 남는 기술 태그가 없으면 제목+본문에서 추출로 폴백("iOS Engineer"·"Go Developer" 등 제목 스택 포착).
    tags = normalize_tech_tags(j.tags) or extract_tech(f"{j.title or ''}\n{plain}")
    embedding = embed_text(f"{j.title}\n{plain}")

    # 구조화 연봉이 없으면 본문에서 명시 범위 추출(원본 통화 표시 + USD 환산 점수용).
    raw_min, raw_max = j.salary_min, j.salary_max
    raw_cur, raw_period = j.salary_currency, j.salary_period
    if raw_min is None and raw_max is None:
        ext = extract_salary_from_description(plain)
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
        "description": clean_structured_html(j.description) or None,
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
        "experience_years": extract_experience_years(plain),
        "seniority": extract_seniority(j.title or ""),
        "embedding": embedding,
    }
    return company_row, job_row
