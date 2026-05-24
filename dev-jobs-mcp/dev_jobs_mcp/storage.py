"""SQLite 기반 영구 저장소 (신규 공고 감지용).

본 적 있는 job_id 를 기록해두고, 다음 체크 때 신규만 골라낸다.
"""
from __future__ import annotations
import sqlite3
from pathlib import Path
from datetime import datetime, timezone
from .models import JobPosting

DB_PATH = Path.home() / ".dev-jobs-mcp" / "seen.db"


def _conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS seen_jobs (
            job_id TEXT PRIMARY KEY,
            title TEXT,
            company TEXT,
            source TEXT,
            first_seen_at TEXT
        )
    """)
    return conn


def filter_new_jobs(jobs: list[JobPosting]) -> list[JobPosting]:
    """본 적 없는 공고만 반환하고, 동시에 기록한다."""
    if not jobs:
        return []
    now = datetime.now(timezone.utc).isoformat()
    new_jobs: list[JobPosting] = []
    with _conn() as conn:
        for job in jobs:
            cur = conn.execute("SELECT 1 FROM seen_jobs WHERE job_id = ?", (job.job_id,))
            if cur.fetchone() is None:
                new_jobs.append(job)
                conn.execute(
                    "INSERT INTO seen_jobs (job_id, title, company, source, first_seen_at) VALUES (?,?,?,?,?)",
                    (job.job_id, job.title, job.company, job.source, now),
                )
        conn.commit()
    return new_jobs


def reset_seen(source: str | None = None) -> int:
    """저장된 기록 초기화 (테스트용). 특정 소스만 또는 전체."""
    with _conn() as conn:
        if source:
            cur = conn.execute("DELETE FROM seen_jobs WHERE source = ?", (source,))
        else:
            cur = conn.execute("DELETE FROM seen_jobs")
        conn.commit()
        return cur.rowcount
