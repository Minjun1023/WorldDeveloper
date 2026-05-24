"""지원 추적 시스템: 관심 공고/지원 상태/메모를 SQLite 에 저장.

상태 단계 (단계별 가중치로 pipeline 통계 계산):
  interested → applied → phone_screen → take_home → onsite → offer → accepted / rejected / withdrawn
"""
from __future__ import annotations
import json
import sqlite3
from pathlib import Path
from datetime import datetime, timezone

DB_PATH = Path.home() / ".dev-jobs-mcp" / "applications.db"

# 표준 상태 (검증용)
VALID_STATUSES = {
    "interested", "applied", "phone_screen", "take_home", "onsite",
    "offer", "accepted", "rejected", "withdrawn",
}

# 상태별 단계 순서 (pipeline 시각화용)
STATUS_ORDER = [
    "interested", "applied", "phone_screen", "take_home",
    "onsite", "offer", "accepted",
]


def _conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS applications (
            job_id TEXT PRIMARY KEY,
            title TEXT,
            company TEXT,
            source TEXT,
            location TEXT,
            apply_url TEXT,
            status TEXT NOT NULL,
            notes TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            metadata TEXT DEFAULT '{}'
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS application_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            from_status TEXT,
            to_status TEXT,
            note TEXT,
            created_at TEXT NOT NULL
        )
    """)
    return conn


def track(
    job_id: str,
    status: str,
    title: str = "",
    company: str = "",
    source: str = "",
    location: str = "",
    apply_url: str = "",
    notes: str = "",
    metadata: dict | None = None,
) -> dict:
    """공고를 추적 목록에 추가하거나 상태 업데이트.

    이미 있는 job_id 면 update, 없으면 insert. 상태 변경 시 이벤트 기록.
    """
    if status not in VALID_STATUSES:
        return {"error": f"잘못된 status: {status}. 유효 값: {sorted(VALID_STATUSES)}"}

    now = datetime.now(timezone.utc).isoformat()
    meta_json = json.dumps(metadata or {})

    with _conn() as conn:
        # 기존 레코드 확인
        cur = conn.execute("SELECT status FROM applications WHERE job_id = ?", (job_id,))
        row = cur.fetchone()

        if row is None:
            conn.execute("""
                INSERT INTO applications (job_id, title, company, source, location, apply_url,
                                         status, notes, created_at, updated_at, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (job_id, title, company, source, location, apply_url, status, notes, now, now, meta_json))
            conn.execute("""
                INSERT INTO application_events (job_id, event_type, from_status, to_status, note, created_at)
                VALUES (?, 'created', NULL, ?, ?, ?)
            """, (job_id, status, notes, now))
            action = "created"
        else:
            old_status = row[0]
            conn.execute("""
                UPDATE applications
                SET status = ?, notes = COALESCE(NULLIF(?, ''), notes), updated_at = ?
                WHERE job_id = ?
            """, (status, notes, now, job_id))
            if old_status != status:
                conn.execute("""
                    INSERT INTO application_events (job_id, event_type, from_status, to_status, note, created_at)
                    VALUES (?, 'status_change', ?, ?, ?, ?)
                """, (job_id, old_status, status, notes, now))
                action = f"updated ({old_status} → {status})"
            else:
                action = "note_updated" if notes else "no_change"

        conn.commit()

    return {"job_id": job_id, "status": status, "action": action, "timestamp": now}


def list_applications(status: str | None = None, company: str | None = None) -> list[dict]:
    """지원 목록 조회. status / company 필터 가능."""
    with _conn() as conn:
        conn.row_factory = sqlite3.Row
        sql = "SELECT * FROM applications WHERE 1=1"
        params: list = []
        if status and status != "all":
            sql += " AND status = ?"
            params.append(status)
        if company:
            sql += " AND LOWER(company) = LOWER(?)"
            params.append(company)
        sql += " ORDER BY updated_at DESC"
        cur = conn.execute(sql, params)
        rows = [dict(r) for r in cur.fetchall()]

    for r in rows:
        try:
            r["metadata"] = json.loads(r.get("metadata") or "{}")
        except json.JSONDecodeError:
            r["metadata"] = {}
    return rows


def get_pipeline_summary() -> dict:
    """단계별 통계 + 회사별 진행 상황."""
    with _conn() as conn:
        # 상태별 카운트
        cur = conn.execute("SELECT status, COUNT(*) FROM applications GROUP BY status")
        by_status = {row[0]: row[1] for row in cur.fetchall()}

        # 전체
        cur = conn.execute("SELECT COUNT(*) FROM applications")
        total = cur.fetchone()[0]

        # 활성 (최종 상태가 아닌 것들)
        active_statuses = {"interested", "applied", "phone_screen", "take_home", "onsite", "offer"}
        active = sum(by_status.get(s, 0) for s in active_statuses)

        # 최근 7일 활동
        from datetime import timedelta
        cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        cur = conn.execute(
            "SELECT COUNT(*) FROM application_events WHERE created_at >= ?", (cutoff,)
        )
        recent_events = cur.fetchone()[0]

    # 깔끔한 단계별 funnel
    funnel = [{"status": s, "count": by_status.get(s, 0)} for s in STATUS_ORDER]

    # 합격률
    accepted = by_status.get("accepted", 0)
    rejected = by_status.get("rejected", 0)
    decided = accepted + rejected
    acceptance_rate = round(accepted / decided, 2) if decided else None

    return {
        "total_applications": total,
        "active_applications": active,
        "by_status": by_status,
        "funnel": funnel,
        "recent_activity_7d": recent_events,
        "acceptance_rate": acceptance_rate,
    }


def get_application_history(job_id: str) -> dict:
    """특정 공고의 전체 이력."""
    with _conn() as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.execute("SELECT * FROM applications WHERE job_id = ?", (job_id,))
        app = cur.fetchone()
        if app is None:
            return {"error": f"추적 중이 아닌 job_id: {job_id}"}

        cur = conn.execute(
            "SELECT * FROM application_events WHERE job_id = ? ORDER BY created_at ASC",
            (job_id,),
        )
        events = [dict(r) for r in cur.fetchall()]

    return {
        "application": dict(app),
        "events": events,
        "event_count": len(events),
    }


def delete_application(job_id: str) -> dict:
    """추적 목록에서 제거 (이벤트 기록도 함께)."""
    with _conn() as conn:
        cur = conn.execute("DELETE FROM applications WHERE job_id = ?", (job_id,))
        conn.execute("DELETE FROM application_events WHERE job_id = ?", (job_id,))
        conn.commit()
        return {"deleted": cur.rowcount > 0, "job_id": job_id}
