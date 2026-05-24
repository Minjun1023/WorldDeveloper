"""추천 피드백 + 룰 기반 가중치 학습.

설계 한계 명시:
- 진짜 ML 학습 (gradient descent 등) 은 데이터/연산 부족으로 안 한다.
- 대신 positive/negative 피드백 받은 공고의 score breakdown 평균을 보고
  '내가 좋아한 추천에서 강했던 차원' 에 가중치 보너스를 주는 단순한 룰을 쓴다.
- 호출 측이 use_learned_weights=True 로 명시할 때만 적용된다.
"""
from __future__ import annotations
import json
import sqlite3
from datetime import datetime
from pathlib import Path

DB_PATH = Path.home() / ".dev-jobs-mcp" / "applications.db"


def _conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS recommendation_feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id TEXT NOT NULL,
            rating TEXT NOT NULL CHECK(rating IN ('positive','negative')),
            score_breakdown_json TEXT,
            notes TEXT,
            created_at TEXT NOT NULL
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_fb_rating ON recommendation_feedback(rating)")
    return conn


def record(
    job_id: str,
    rating: str,
    score_breakdown: dict | None = None,
    notes: str = "",
) -> dict:
    """피드백 1건 저장."""
    rating = rating.lower()
    if rating not in ("positive", "negative"):
        return {"error": "rating must be 'positive' or 'negative'"}
    payload = json.dumps(score_breakdown) if score_breakdown else None
    now = datetime.utcnow().isoformat()
    with _conn() as conn:
        cur = conn.execute(
            "INSERT INTO recommendation_feedback(job_id, rating, score_breakdown_json, notes, created_at) "
            "VALUES(?,?,?,?,?)",
            (job_id, rating, payload, notes, now),
        )
        conn.commit()
    return {"id": cur.lastrowid, "job_id": job_id, "rating": rating}


def get_summary() -> dict:
    """저장된 피드백 + 학습된 가중치 보너스를 반환.

    학습 룰:
    1) positive 피드백들의 score breakdown 차원별 평균을 구한다.
    2) 어떤 차원이 (positive 평균 - negative 평균) > 0.15 이상이면
       그 차원에 +20% 가중치 보너스 추천.
    3) 데이터 5건 미만이면 학습 비활성 (cold start).
    """
    with _conn() as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT rating, score_breakdown_json FROM recommendation_feedback"
        ).fetchall()

    if len(rows) < 5:
        return {
            "feedback_count": len(rows),
            "learned_weight_bonus": {},
            "note": f"학습 활성화 최소 5건 필요 (현재 {len(rows)}건). 더 피드백을 쌓으세요.",
        }

    dims = ["stack", "visa", "location", "seniority", "salary", "semantic"]
    pos_sums = {d: 0.0 for d in dims}
    neg_sums = {d: 0.0 for d in dims}
    pos_count = neg_count = 0

    for r in rows:
        if not r["score_breakdown_json"]:
            continue
        try:
            bd = json.loads(r["score_breakdown_json"])
        except (json.JSONDecodeError, TypeError):
            continue
        if r["rating"] == "positive":
            pos_count += 1
            for d in dims:
                pos_sums[d] += float(bd.get(d, 0) or 0)
        else:
            neg_count += 1
            for d in dims:
                neg_sums[d] += float(bd.get(d, 0) or 0)

    if pos_count == 0:
        return {
            "feedback_count": len(rows),
            "learned_weight_bonus": {},
            "note": "positive 피드백이 0건이라 학습 불가",
        }

    bonus: dict[str, float] = {}
    for d in dims:
        pos_avg = pos_sums[d] / pos_count
        neg_avg = neg_sums[d] / neg_count if neg_count else 0.0
        diff = pos_avg - neg_avg
        if diff > 0.15:  # 의미있는 차이
            bonus[d] = round(0.20 * (diff / 1.0), 3)  # 최대 ~+0.20

    return {
        "feedback_count": len(rows),
        "positive_count": pos_count,
        "negative_count": neg_count,
        "learned_weight_bonus": bonus,
        "note": "use_learned_weights=True 로 recommend_jobs 호출 시 적용됩니다.",
    }


def apply_to_weights(base_weights: dict) -> dict:
    """기본 가중치 dict 에 학습된 보너스를 더하고 다시 정규화."""
    summary = get_summary()
    bonus = summary.get("learned_weight_bonus", {})
    if not bonus:
        return dict(base_weights)

    out = dict(base_weights)
    for d, b in bonus.items():
        if d in out:
            out[d] = out[d] + b
    # 정규화 (합 = 1.0)
    total = sum(out.values())
    if total > 0:
        out = {k: v / total for k, v in out.items()}
    return out
