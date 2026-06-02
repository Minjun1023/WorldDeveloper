"""임베딩 backfill: active 공고의 embedding 컬럼을 채운다 (비파괴 — 컬럼만 UPDATE).

ETL 과 동일한 텍스트(title + description_text, 여기서 description_text = html_strip(description))로
임베딩을 계산해 추천 의미검색을 활성화한다. sentence-transformers([embeddings] extra) 설치 +
모델 로드가 가능해야 한다(미설치 시 즉시 종료).

실행: cd ai && uv run python -m scripts.backfill_embeddings
"""
import psycopg
from pgvector.psycopg import register_vector

from app.config import settings
from dev_jobs_core.recommender import embeddings as emb

if not emb.is_available():
    raise SystemExit(
        "임베딩 모델 미가용 — 'uv sync --extra embeddings' 후 다시 실행하세요."
    )

conn = psycopg.connect(settings.database_url)
register_vector(conn)
rows = conn.execute(
    "SELECT id, title, description_text FROM jobs WHERE is_active = true"
).fetchall()
total = len(rows)

done = 0
skipped = 0
with conn.cursor() as cur:
    for jid, title, dtext in rows:
        text = f"{title or ''}\n{dtext or ''}".strip()
        vec = emb.embed_text(text)
        if vec is None:
            skipped += 1
            continue
        cur.execute("UPDATE jobs SET embedding = %s WHERE id = %s", (vec, jid))
        done += 1
        if done % 200 == 0:
            conn.commit()
            print(f"  {done}/{total} ...", flush=True)
conn.commit()
conn.close()
print(f"done={done} skipped={skipped} total={total}")
