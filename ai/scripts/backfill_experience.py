"""경력/시니어리티 backfill: active 공고의 experience_years/seniority 컬럼을 채운다.

ETL transform 과 동일하게 description_text 에서 경력(요구 연차), title 에서 시니어리티를
추출해 채운다. 비파괴(새 두 컬럼만 UPDATE), 멱등(재실행 동일).

실행: cd ai && PYTHONPATH="$PWD" .venv/bin/python -m scripts.backfill_experience
"""
import psycopg

from app.config import settings
from dev_jobs_core.analyzers.experience import extract_experience_years
from dev_jobs_core.analyzers.seniority import extract_seniority

conn = psycopg.connect(settings.database_url)
rows = conn.execute(
    "SELECT id, title, description_text FROM jobs WHERE is_active = true"
).fetchall()
total = len(rows)

done = 0
with conn.cursor() as cur:
    for jid, title, dtext in rows:
        exp = extract_experience_years(dtext or "")
        sen = extract_seniority(title or "")
        cur.execute(
            "UPDATE jobs SET experience_years = %s, seniority = %s WHERE id = %s",
            (exp, sen, jid),
        )
        done += 1
        if done % 500 == 0:
            conn.commit()
            print(f"  {done}/{total} ...", flush=True)
conn.commit()
conn.close()
print(f"done={done} total={total}")
