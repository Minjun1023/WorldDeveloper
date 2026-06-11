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


def upsert_company(conn: psycopg.Connection, company: dict[str, Any]) -> None:
    conn.execute(
        """
        INSERT INTO companies (slug, display_name, ats, ats_token, tags)
        VALUES (%(slug)s, %(display_name)s, %(ats)s, %(ats_token)s, %(tags)s)
        ON CONFLICT (slug) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            ats          = COALESCE(EXCLUDED.ats, companies.ats),
            ats_token    = COALESCE(EXCLUDED.ats_token, companies.ats_token),
            tags         = EXCLUDED.tags
        """,
        company,
    )


def upsert_job(conn: psycopg.Connection, job: dict[str, Any]) -> None:
    """공고 upsert. 재관측 시 last_seen_at 갱신 + is_active=true 복구."""
    params = dict(job)
    params["visa_evidence"] = Json(job.get("visa_evidence") or [])
    params["remote_evidence"] = Json(job.get("remote_evidence") or [])
    conn.execute(
        """
        INSERT INTO jobs (
            id, source, title, company_slug, location, is_remote, employment_type,
            description, description_text, apply_url, posted_at, closes_at, tags,
            salary_min, salary_max, salary_currency, salary_period,
            salary_min_usd, salary_max_usd, experience_years, seniority, visa_status, visa_evidence,
            remote_eligibility, remote_evidence, embedding,
            first_seen_at, last_seen_at, is_active
        ) VALUES (
            %(id)s, %(source)s, %(title)s, %(company_slug)s, %(location)s, %(is_remote)s,
            %(employment_type)s, %(description)s, %(description_text)s, %(apply_url)s,
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
            is_remote       = EXCLUDED.is_remote,
            employment_type = EXCLUDED.employment_type,
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
        """,
        params,
    )


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
