"""비파괴적 backfill: active 공고에 remote_eligibility/remote_evidence 채움.

ETL upsert/drop 파이프라인을 타지 않고, 기존 행에 분류 결과만 UPDATE 한다.
원격 적격 라이브 검증용 — 실데이터 분포로 게이트/트랙을 확인하기 위함.
"""
import psycopg
from psycopg.types.json import Json

from app.config import settings
from dev_jobs_core.analyzers.remote_geo import classify_remote_eligibility

conn = psycopg.connect(settings.database_url)
rows = conn.execute(
    "SELECT id, location, is_remote, description, title FROM jobs WHERE is_active = true"
).fetchall()

dist = {}
updated = 0
with conn.cursor() as cur:
    for jid, loc, is_remote, desc, title in rows:
        status, ev = classify_remote_eligibility(
            loc or "", bool(is_remote), desc or "", title=title or ""
        )
        cur.execute(
            "UPDATE jobs SET remote_eligibility = %s, remote_evidence = %s WHERE id = %s",
            (status, Json(ev or []), jid),
        )
        dist[status] = dist.get(status, 0) + 1
        updated += 1
conn.commit()
conn.close()

print(f"updated={updated}")
for k in sorted(dist, key=lambda x: (x is None, str(x))):
    print(f"  {k if k is not None else 'None(onsite)'}: {dist[k]}")
