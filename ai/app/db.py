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
    conn.execute(
        """
        INSERT INTO jobs (
            id, source, title, company_slug, location, is_remote, employment_type,
            description, description_text, apply_url, posted_at, tags,
            salary_min_usd, salary_max_usd, visa_status, visa_evidence, embedding,
            first_seen_at, last_seen_at, is_active
        ) VALUES (
            %(id)s, %(source)s, %(title)s, %(company_slug)s, %(location)s, %(is_remote)s,
            %(employment_type)s, %(description)s, %(description_text)s, %(apply_url)s,
            %(posted_at)s, %(tags)s, %(salary_min_usd)s, %(salary_max_usd)s,
            %(visa_status)s, %(visa_evidence)s, %(embedding)s,
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
            tags            = EXCLUDED.tags,
            salary_min_usd  = EXCLUDED.salary_min_usd,
            salary_max_usd  = EXCLUDED.salary_max_usd,
            visa_status     = EXCLUDED.visa_status,
            visa_evidence   = EXCLUDED.visa_evidence,
            embedding       = EXCLUDED.embedding,
            last_seen_at    = now(),
            is_active       = true
        """,
        params,
    )


def deactivate_stale(conn: psycopg.Connection, days: int = 7) -> int:
    """days 일 이상 미관측 공고를 soft delete (is_active=false)."""
    cur = conn.execute(
        "UPDATE jobs SET is_active = false "
        "WHERE is_active = true AND last_seen_at < now() - make_interval(days => %s)",
        (days,),
    )
    return cur.rowcount
