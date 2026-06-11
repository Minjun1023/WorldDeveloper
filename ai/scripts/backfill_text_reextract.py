"""텍스트 재가공 + 재추출 backfill.

html_strip 엔티티 디코드 수정 후, 기존 active 공고의 description_text 를 재가공하고
salary/experience/seniority 를 재추출한다. 비파괴·멱등.

급여 보호: salary_* 는 '발견 시에만' 채운다 — 텍스트에 급여가 없는 Ashby 등의
소스 구조화 급여를 None 으로 덮어쓰지 않기 위함. description_text/experience/seniority
는 항상 재추출로 UPDATE(멱등).

실행: cd ai && PYTHONPATH="$PWD" .venv/bin/python -m scripts.backfill_text_reextract
"""
import psycopg

from app.config import settings
from app.etl.transform import _usd, html_strip
from dev_jobs_core.analyzers.experience import extract_experience_years
from dev_jobs_core.analyzers.salary import extract_salary_from_description
from dev_jobs_core.analyzers.seniority import extract_seniority

conn = psycopg.connect(settings.database_url)
rows = conn.execute(
    "SELECT id, title, description FROM jobs WHERE is_active = true"
).fetchall()
total = len(rows)

done = 0
sal_set = 0
with conn.cursor() as cur:
    for jid, title, description in rows:
        dtext = html_strip(description or "")
        exp = extract_experience_years(dtext)
        sen = extract_seniority(title or "")
        cur.execute(
            "UPDATE jobs SET description_text=%s, experience_years=%s, seniority=%s WHERE id=%s",
            (dtext or None, exp, sen, jid),
        )
        sal = extract_salary_from_description(dtext)
        if sal:
            cur.execute(
                "UPDATE jobs SET salary_min=%s, salary_max=%s, salary_currency=%s, "
                "salary_period=%s, salary_min_usd=%s, salary_max_usd=%s WHERE id=%s",
                (
                    sal["min"], sal["max"], sal["currency"], sal["period"],
                    _usd(sal["min"], sal["currency"], sal["period"]),
                    _usd(sal["max"], sal["currency"], sal["period"]),
                    jid,
                ),
            )
            sal_set += 1
        done += 1
        if done % 500 == 0:
            conn.commit()
            print(f"  {done}/{total} (salary set {sal_set}) ...", flush=True)
conn.commit()
conn.close()
print(f"done={done} salary_set={sal_set} total={total}")
