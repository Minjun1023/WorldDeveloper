"""태그 정리 backfill: active 공고의 tags 에서 비기술 라벨 제거(기술스택만 남김).

ETL transform 과 동일 로직 — 기존 tags 를 normalize_tech_tags 로 정리하고,
남는 기술 태그가 없으면 description_text 에서 extract_tech 로 재추출해 폴백한다.
대부분 ATS 공고는 이미 extract_tech 결과(=vocab)라 무변동, 보드 공고(arbeitnow/remoteok 등)만 정리됨.
비파괴(tags 컬럼만 UPDATE), 멱등(재실행 동일).

실행: cd ai && PYTHONPATH="$PWD" .venv/bin/python -m scripts.backfill_tags_normalize
"""
import psycopg

from app.config import settings
from dev_jobs_core.analyzers.stack import extract_tech, normalize_tech_tags

conn = psycopg.connect(settings.database_url)
rows = conn.execute(
    "SELECT id, title, tags, description_text FROM jobs WHERE is_active = true"
).fetchall()
total = len(rows)

done = 0
changed = 0
with conn.cursor() as cur:
    for jid, title, tags, dtext in rows:
        new_tags = normalize_tech_tags(tags or []) or extract_tech(f"{title or ''}\n{dtext or ''}")
        if new_tags != (tags or []):
            cur.execute("UPDATE jobs SET tags = %s WHERE id = %s", (new_tags, jid))
            changed += 1
        done += 1
        if done % 500 == 0:
            conn.commit()
            print(f"  {done}/{total} (changed={changed}) ...", flush=True)
conn.commit()
conn.close()
print(f"done={done} total={total} changed={changed}")
