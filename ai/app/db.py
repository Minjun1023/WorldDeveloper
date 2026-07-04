"""Postgres 접근 레이어 (psycopg3 + pgvector).

ETL 이 companies/jobs 를 upsert. 사용자 요청 처리는 Spring 백엔드가 담당하므로
여기서는 쓰기(upsert) 중심.
"""
from __future__ import annotations

import logging
from typing import Any

import psycopg
from pgvector.psycopg import register_vector
from psycopg.types.json import Json

from .config import settings

log = logging.getLogger(__name__)


def get_conn() -> psycopg.Connection:
    """vector 어댑터가 등록된 새 커넥션."""
    conn = psycopg.connect(settings.database_url)
    register_vector(conn)
    return conn


_COMPANY_UPSERT = """
    INSERT INTO companies (slug, display_name, ats, ats_token, tags)
    VALUES (%(slug)s, %(display_name)s, %(ats)s, %(ats_token)s, %(tags)s)
    ON CONFLICT (slug) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        ats          = COALESCE(EXCLUDED.ats, companies.ats),
        ats_token    = COALESCE(EXCLUDED.ats_token, companies.ats_token),
        tags         = EXCLUDED.tags
"""

_JOB_UPSERT = """
    INSERT INTO jobs (
        id, source, title, company_slug, location, country, city, is_remote, employment_type,
        department, relocation_support, language_requirement,
        description, description_text, apply_url, posted_at, closes_at, tags,
        salary_min, salary_max, salary_currency, salary_period,
        salary_min_usd, salary_max_usd, experience_years, seniority, visa_status, visa_evidence,
        remote_eligibility, remote_evidence, embedding,
        first_seen_at, last_seen_at, is_active
    ) VALUES (
        %(id)s, %(source)s, %(title)s, %(company_slug)s, %(location)s, %(country)s, %(city)s, %(is_remote)s,
        %(employment_type)s, %(department)s, %(relocation_support)s, %(language_requirement)s,
        %(description)s, %(description_text)s, %(apply_url)s,
        %(posted_at)s, %(closes_at)s, %(tags)s,
        %(salary_min)s, %(salary_max)s, %(salary_currency)s, %(salary_period)s,
        %(salary_min_usd)s, %(salary_max_usd)s, %(experience_years)s, %(seniority)s,
        %(visa_status)s, %(visa_evidence)s,
        %(remote_eligibility)s, %(remote_evidence)s, %(embedding)s,
        now(), now(), true
    )
    ON CONFLICT (id) DO UPDATE SET
        title           = EXCLUDED.title,
        location        = EXCLUDED.location,
        country         = EXCLUDED.country,
        city            = EXCLUDED.city,
        is_remote       = EXCLUDED.is_remote,
        employment_type = EXCLUDED.employment_type,
        department      = EXCLUDED.department,
        relocation_support   = EXCLUDED.relocation_support,
        language_requirement = EXCLUDED.language_requirement,
        description     = EXCLUDED.description,
        description_text= EXCLUDED.description_text,
        apply_url       = EXCLUDED.apply_url,
        posted_at       = EXCLUDED.posted_at,
        closes_at       = EXCLUDED.closes_at,
        tags            = EXCLUDED.tags,
        salary_min      = EXCLUDED.salary_min,
        salary_max      = EXCLUDED.salary_max,
        salary_currency = EXCLUDED.salary_currency,
        salary_period   = EXCLUDED.salary_period,
        salary_min_usd  = EXCLUDED.salary_min_usd,
        salary_max_usd  = EXCLUDED.salary_max_usd,
        experience_years = EXCLUDED.experience_years,
        seniority        = EXCLUDED.seniority,
        visa_status     = EXCLUDED.visa_status,
        visa_evidence   = EXCLUDED.visa_evidence,
        remote_eligibility = EXCLUDED.remote_eligibility,
        remote_evidence    = EXCLUDED.remote_evidence,
        embedding       = EXCLUDED.embedding,
        last_seen_at    = now(),
        is_active       = true
"""


def _job_params(job: dict[str, Any]) -> dict[str, Any]:
    """upsert 파라미터 정규화 — jsonb 컬럼(evidence)을 Json 래핑."""
    p = dict(job)
    p.setdefault("country", None)  # 구버전 호출부 호환(named param 누락 방지)
    p.setdefault("city", None)
    p.setdefault("department", None)
    p.setdefault("relocation_support", None)
    p.setdefault("language_requirement", None)
    p["visa_evidence"] = Json(job.get("visa_evidence") or [])
    p["remote_evidence"] = Json(job.get("remote_evidence") or [])
    return p


def upsert_company(conn: psycopg.Connection, company: dict[str, Any]) -> None:
    conn.execute(_COMPANY_UPSERT, company)


def upsert_job(conn: psycopg.Connection, job: dict[str, Any]) -> None:
    """공고 upsert. 재관측 시 last_seen_at 갱신 + is_active=true 복구."""
    conn.execute(_JOB_UPSERT, _job_params(job))


def upsert_companies(conn: psycopg.Connection, companies: list[dict[str, Any]]) -> None:
    """여러 회사 batch upsert(executemany) — slug 로 dedup 후 호출 권장. DB 라운드트립 절감.

    배치가 한 행 때문에 통째로 실패하면(현 행별 격리 손실) savepoint 로 감싼 행별 폴백으로 떨어진다.
    """
    if not companies:
        return
    try:
        with conn.transaction(), conn.cursor() as cur:
            cur.executemany(_COMPANY_UPSERT, companies)
    except Exception:  # noqa: BLE001 — 배치 실패 → 행별 폴백
        for c in companies:
            try:
                with conn.transaction():
                    conn.execute(_COMPANY_UPSERT, c)
            except Exception as e:  # noqa: BLE001
                log.warning("company upsert 실패 %s: %s", c.get("slug"), e)


def upsert_jobs(conn: psycopg.Connection, jobs: list[dict[str, Any]]) -> tuple[int, int]:
    """여러 공고 batch upsert(executemany). (성공, 실패) 반환.

    한 행 실패가 전체를 막지 않도록: 배치를 savepoint 로 시도하고, 실패하면 행별(각자 savepoint)
    폴백 — 기존 행별 try/except 의 격리성을 유지하면서 happy-path 만 배치로 가속한다.
    """
    if not jobs:
        return 0, 0
    rows = [_job_params(j) for j in jobs]
    try:
        with conn.transaction(), conn.cursor() as cur:
            cur.executemany(_JOB_UPSERT, rows)
        return len(rows), 0
    except Exception:  # noqa: BLE001 — 배치 실패 → 행별 폴백(격리)
        ok = fail = 0
        for r in rows:
            try:
                with conn.transaction():
                    conn.execute(_JOB_UPSERT, r)
                ok += 1
            except Exception as e:  # noqa: BLE001
                fail += 1
                log.warning("upsert 실패 %s: %s", r.get("id"), e)
        return ok, fail


def fetch_unclear_jobs(conn: psycopg.Connection, limit: int | None = None) -> list[dict[str, Any]]:
    sql = (
        "SELECT id, title, description_text, company_slug, location, is_remote FROM jobs "
        "WHERE is_active = true AND visa_status = 'unclear' "
        "ORDER BY posted_at DESC NULLS LAST"
    )
    rows = conn.execute(sql + (" LIMIT %s" if limit else ""), (limit,) if limit else None).fetchall()
    return [
        {"id": r[0], "title": r[1], "description_text": r[2], "company_slug": r[3],
         "location": r[4], "is_remote": r[5]}
        for r in rows
    ]


def sponsor_company_slugs(conn: psycopg.Connection) -> set[str]:
    rows = conn.execute(
        "SELECT DISTINCT company_slug FROM jobs WHERE is_active = true AND visa_status = 'sponsors'"
    ).fetchall()
    return {r[0] for r in rows if r[0]}


def fetch_sponsor_jobs_for_companies(
    conn: psycopg.Connection, slugs: list[str]
) -> list[dict[str, Any]]:
    """이미 sponsors 로 분류된 활성 공고 중 주어진 회사들의 것(명부 근거 stamp 대상)."""
    if not slugs:
        return []
    rows = conn.execute(
        "SELECT id, company_slug, location, is_remote, visa_evidence FROM jobs "
        "WHERE is_active = true AND visa_status = 'sponsors' AND company_slug = ANY(%s)",
        (list(slugs),),
    ).fetchall()
    return [
        {"id": r[0], "company_slug": r[1], "location": r[2],
         "is_remote": r[3], "visa_evidence": r[4] or []}
        for r in rows
    ]


def update_visa(conn: psycopg.Connection, job_id: str, status: str, evidence: list[str]) -> None:
    conn.execute(
        "UPDATE jobs SET visa_status = %s, visa_evidence = %s WHERE id = %s",
        (status, Json(evidence or []), job_id),
    )


def deactivate_stale(conn: psycopg.Connection, days: int = 7) -> int:
    """days 일 이상 미관측 공고를 soft delete (is_active=false)."""
    cur = conn.execute(
        "UPDATE jobs SET is_active = false "
        "WHERE is_active = true AND last_seen_at < now() - make_interval(days => %s)",
        (days,),
    )
    return cur.rowcount


def active_id_titles(conn: psycopg.Connection) -> list[tuple[str, str]]:
    """활성 공고의 (id, title) 전체 — ETL 의 저장분 재필터용."""
    rows = conn.execute("SELECT id, title FROM jobs WHERE is_active = true").fetchall()
    return [(r[0], r[1] or "") for r in rows]


def deactivate_jobs(conn: psycopg.Connection, ids: list[str]) -> int:
    """주어진 id 들을 soft delete (is_active=false). 빈 리스트면 0."""
    if not ids:
        return 0
    cur = conn.execute("UPDATE jobs SET is_active = false WHERE id = ANY(%s)", (ids,))
    return cur.rowcount


def deactivate_unseen_in_scopes(
    conn: psycopg.Connection,
    ats_prefixes: list[str],
    board_sources: list[str],
    threshold,
) -> int:
    """성공+완전(미캡) 수집된 범위에서 이번 사이클에 재관측되지 않은 공고를 즉시 soft delete.

    소스/회사가 이번에 정상 수집됐고(실패 아님) 결과가 limit 미만(전량 수집, 잘림 없음)일 때만
    그 범위를 넘긴다 → "안 보임 = 정말 내려감"이 보장돼 7일 유예 없이 다음 사이클에 제거.
    일시 실패하거나 limit 에 잘린 범위는 호출부에서 제외하므로 깜빡임/오삭제가 없다.

    - ats_prefixes: "{source}:{company_slug}" 목록 (예: "greenhouse:stripe"). job id 접두와 동일.
    - board_sources: 잡보드 source 목록 (예: ["wwr"]). 회사 구분 없이 source 전체.
    - threshold: 이 시각 이전 last_seen_at = 이번 사이클 미관측. (업서트 직전 DB now() 권장)
    """
    if not ats_prefixes and not board_sources:
        return 0
    cur = conn.execute(
        """
        UPDATE jobs SET is_active = false
        WHERE is_active = true AND last_seen_at < %(threshold)s AND (
            (source || ':' || company_slug) = ANY(%(ats)s)
            OR source = ANY(%(boards)s)
        )
        """,
        {"threshold": threshold, "ats": ats_prefixes, "boards": board_sources},
    )
    return cur.rowcount


def deactivate_expired(conn: psycopg.Connection, max_age_days: int = 45) -> int:
    """마감 지난 공고를 soft delete.

    - closes_at 이 있으면 그 날짜 기준으로 만료
    - closes_at 이 없으면 posted_at + max_age_days 기준으로 만료 (게시일 만료 fallback)
    """
    cur = conn.execute(
        """
        UPDATE jobs SET is_active = false
        WHERE is_active = true AND (
            (closes_at IS NOT NULL AND closes_at < now())
            OR (closes_at IS NULL AND posted_at IS NOT NULL
                AND posted_at < now() - make_interval(days => %s))
        )
        """,
        (max_age_days,),
    )
    return cur.rowcount
