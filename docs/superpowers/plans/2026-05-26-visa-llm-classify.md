# 비자 분류 개선: 키워드 확장 + LLM 보조 + 회사 추론 구현 계획

> superpowers:subagent-driven-development. AI 서비스(Python) 중심. 백엔드/프론트 무변경.

**Goal:** "정보 없음(unclear, 90%)"을 줄인다. unclear 공고를 ① 확장 키워드 → ② LLM(gpt-4o-mini) → ③ 회사 추론 순으로 재분류. 매 ETL 사이클 자동 + 수동 백필 엔드포인트. 기존 837 unclear 백필.

**설계 결정(사용자 승인):** 키워드/회사 + LLM 보조, LLM은 **매 ETL 사이클**(unclear만, 설명 캐시). 회사 추론은 보수적+투명(같은 회사에 명시 sponsor 공고 있으면 그 회사 unclear를 sponsors 승격, 근거 표기). 키는 `ai/.env`의 `OPENAI_API_KEY`(설정됨). 키 없으면 LLM 단계 graceful skip.

**파이프라인(공고당, unclear에 한해):** 확장 키워드 → (unclear면) LLM → (unclear면) 회사 추론. 명시 시그널 우선.

---

## Task 1: 키워드 확장 (visa.py + MCP 미러)
**Modify:** `ai/dev_jobs_core/analyzers/visa.py` **AND** `dev-jobs-mcp/dev_jobs_mcp/analyzers/visa.py` (동일 적용)

- [ ] `NO_SPONSOR_PATTERNS` 리스트에 추가(고신뢰 문구):
```python
    r"\bauthorized\s+to\s+work\s+in\b",
    r"\b(?:legally\s+)?(?:eligible|entitled)\s+to\s+work\s+(?:in|without)\b",
    r"\bright\s+to\s+work\s+in\b",
    r"\bwithout\s+(?:visa\s+)?sponsorship\b",
    r"\bdo(?:es)?\s+not\s+(?:provide|offer)\s+(?:visa\s+)?sponsorship\b",
    r"\bwork\s+authorization\s+(?:is\s+)?required\b",
    r"\bexisting\s+work\s+authorization\b",
```
- [ ] `SPONSOR_PATTERNS` 리스트에 추가(고신뢰):
```python
    r"\bvisa\s+support\b",
    r"\bwe\s+sponsor\s+(?:work\s+)?visas?\b",
    r"\bsponsor\s+(?:your\s+)?(?:work\s+)?visa\b",
    r"\brelocation\s+(?:reimbursement|stipend)\b",
    r"\bvisa\s+(?:and\s+|&\s+)?relocation\b",
```
(애매한 "international applicants welcome" 류는 LLM에 맡기고 키워드엔 넣지 않음 — false positive 회피.)

- [ ] 테스트 `ai/tests/test_visa.py` (신규): 신규 문구 검증
```python
from dev_jobs_core.analyzers.visa import classify_visa

def test_no_sponsor_authorized_to_work():
    assert classify_visa("You must be authorized to work in the United States.")[0] == "no_sponsor"
def test_no_sponsor_without_sponsorship():
    assert classify_visa("This role is available without sponsorship.")[0] == "no_sponsor"
def test_sponsor_visa_support():
    assert classify_visa("We provide visa support and relocation reimbursement.")[0] == "sponsors"
def test_sponsor_we_sponsor_visas():
    assert classify_visa("We sponsor work visas for the right candidate.")[0] == "sponsors"
def test_unclear_silent():
    assert classify_visa("Great team, Python and Go, fast-paced startup.")[0] == "unclear"
def test_empty_unclear():
    assert classify_visa("")[0] == "unclear"
```
- [ ] `cd ai && uv run pytest tests/test_visa.py -q` 통과. 커밋:
```bash
git add ai/dev_jobs_core/analyzers/visa.py dev-jobs-mcp/dev_jobs_mcp/analyzers/visa.py ai/tests/test_visa.py
git commit -m "feat(ai-visa): 키워드 패턴 확장(고신뢰 sponsor/no_sponsor 문구) + 테스트"
```

---

## Task 2: LLM 비자 분류기 (`ai/app/etl/visa_llm.py`)
**Create** (summarize.py 패턴 미러, gpt-4o-mini, JSON, 키 없으면 None):
```python
"""LLM(gpt-4o-mini) 비자 분류 — unclear 공고 전문을 읽어 분류. 키 없거나 실패 시 None."""
from __future__ import annotations

import json
import logging
import os

import httpx

from ..config import settings

log = logging.getLogger(__name__)

OPENAI_URL = "https://api.openai.com/v1/chat/completions"
MODEL = "gpt-4o-mini"
_VALID = {"sponsors", "no_sponsor", "unclear"}

SYSTEM = (
    "You classify whether a software engineering job posting offers VISA SPONSORSHIP or "
    "relocation for an international (non-local) candidate, based ONLY on the posting text. "
    'Respond with ONLY a JSON object: {"status": "sponsors"|"no_sponsor"|"unclear", '
    '"reason": "<short Korean phrase>"}. '
    '"sponsors": states or clearly implies it will sponsor a work visa, work permit, or relocation. '
    '"no_sponsor": requires existing work authorization, states no sponsorship, or citizens/residents only. '
    '"unclear": the posting does not mention visa, work authorization, or relocation at all. '
    "Do not infer from company or location — only the posting text."
)


async def classify_visa_llm(title: str, description: str) -> tuple[str, list[str]] | None:
    key = settings.openai_api_key or os.getenv("OPENAI_API_KEY")
    if not key or not (description or "").strip():
        return None
    user = json.dumps({"title": title or "", "description": description[:12000]}, ensure_ascii=False)
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                OPENAI_URL,
                headers={"Authorization": f"Bearer {key}", "content-type": "application/json"},
                json={
                    "model": MODEL,
                    "max_tokens": 200,
                    "temperature": 0.0,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": SYSTEM},
                        {"role": "user", "content": user},
                    ],
                },
            )
        if resp.status_code != 200:
            log.warning("visa LLM HTTP %s: %s", resp.status_code, resp.text[:200])
            return None
        obj = json.loads(resp.json()["choices"][0]["message"]["content"] or "{}")
        status = obj.get("status")
        if status not in _VALID:
            return None
        reason = obj.get("reason")
        evidence = [f"AI: {reason}"] if isinstance(reason, str) and reason.strip() else ["AI 분류"]
        return status, evidence
    except (httpx.HTTPError, KeyError, IndexError, ValueError, AttributeError) as e:
        log.warning("visa LLM 실패: %s", e)
        return None
```
- [ ] 테스트 `ai/tests/test_visa_llm.py` (신규): `test_summarize_route.py`의 httpx mock 패턴 미러 — monkeypatch 로 OpenAI 응답 `{"status":"sponsors","reason":"비자 지원 명시"}` 주입 → `("sponsors", ["AI: 비자 지원 명시"])`; 키 없을 때 None; status 이상값이면 None. (settings.openai_api_key 를 테스트에서 set/monkeypatch.)
- [ ] `cd ai && uv run pytest tests/test_visa_llm.py -q` 통과. 커밋:
```bash
git add ai/app/etl/visa_llm.py ai/tests/test_visa_llm.py
git commit -m "feat(ai-visa): LLM(gpt-4o-mini) 비자 분류기 + 테스트"
```

---

## Task 3: db.py 헬퍼 + 재분류 패스 + ETL 훅 + 엔드포인트
**Modify:** `ai/app/db.py` — 헬퍼 3개 추가:
```python
def fetch_unclear_jobs(conn: psycopg.Connection, limit: int | None = None) -> list[dict[str, Any]]:
    sql = (
        "SELECT id, title, description_text, company_slug FROM jobs "
        "WHERE is_active = true AND visa_status = 'unclear' "
        "ORDER BY posted_at DESC NULLS LAST"
    )
    rows = conn.execute(sql + (" LIMIT %s" if limit else ""), (limit,) if limit else None).fetchall()
    return [
        {"id": r[0], "title": r[1], "description_text": r[2], "company_slug": r[3]}
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
```

**Create:** `ai/app/etl/visa_reclassify.py`:
```python
"""unclear 공고 재분류: 확장 키워드 → LLM → 회사 추론. 매 ETL 사이클 + 수동 백필."""
from __future__ import annotations

import asyncio
import logging

from dev_jobs_core.analyzers.visa import classify_visa

from ..db import fetch_unclear_jobs, get_conn, sponsor_company_slugs, update_visa
from .visa_llm import classify_visa_llm

log = logging.getLogger(__name__)

_LLM_CONCURRENCY = 8


async def reclassify_unclear_visa(limit: int | None = None) -> dict:
    conn = get_conn()
    try:
        jobs = fetch_unclear_jobs(conn, limit)
        sponsor_companies = sponsor_company_slugs(conn)

        results: dict[str, tuple[str, list[str]]] = {}
        by_keyword = 0
        # 1) 확장 키워드 (sync)
        remaining = []
        for j in jobs:
            status, ev = classify_visa(j["description_text"] or "")
            if status != "unclear":
                results[j["id"]] = (status, ev)
                by_keyword += 1
            else:
                remaining.append(j)

        # 2) LLM (동시성 제한 + 설명 캐시)
        cache: dict[str, tuple[str, list[str]] | None] = {}
        sem = asyncio.Semaphore(_LLM_CONCURRENCY)

        async def run(j):
            desc = j["description_text"] or ""
            if desc not in cache:
                async with sem:
                    cache[desc] = await classify_visa_llm(j["title"], desc)
            return j["id"], cache[desc]

        by_llm = 0
        if remaining:
            for jid, out in await asyncio.gather(*[run(j) for j in remaining]):
                if out and out[0] != "unclear":
                    results[jid] = out
                    by_llm += 1

        # 3) 회사 추론 (여전히 unclear + 회사에 명시 sponsor 공고)
        by_company = 0
        for j in jobs:
            if j["id"] not in results and j["company_slug"] in sponsor_companies:
                results[j["id"]] = ("sponsors", ["같은 회사의 다른 공고에 비자 스폰서 명시"])
                by_company += 1

        # 4) UPDATE
        for jid, (status, ev) in results.items():
            update_visa(conn, jid, status, ev)
        conn.commit()

        return {
            "unclear_in": len(jobs),
            "updated": len(results),
            "by_keyword": by_keyword,
            "by_llm": by_llm,
            "by_company": by_company,
            "still_unclear": len(jobs) - len(results),
        }
    finally:
        conn.close()
```

**Modify:** `ai/app/etl/jobs.py` — `run_full_cycle` 의 메인 사이클(conn.close()) 이후, `log.info(...)`/`return result` 직전에:
```python
    # 5. unclear 비자 재분류 (확장키워드 → LLM → 회사 추론)
    try:
        result["visa_reclassified"] = await reclassify_unclear_visa()
    except Exception as e:  # noqa: BLE001
        log.warning("visa 재분류 실패: %s", e)
        result["visa_reclassified"] = {"error": str(e)}
```
파일 상단 import 추가: `from .visa_reclassify import reclassify_unclear_visa`.

**Modify:** `ai/app/routes/etl.py` — 엔드포인트 추가:
```python
from ..etl.visa_reclassify import reclassify_unclear_visa
# ...
@router.post("/etl/reclassify-visa")
async def reclassify_visa_endpoint(limit: int | None = None) -> dict:
    try:
        return {"status": "ok", "result": await reclassify_unclear_visa(limit)}
    except Exception as e:
        raise HTTPException(500, f"reclassify failed: {e}") from e
```

- [ ] `cd ai && uv run pytest tests/ -q` (전체) 통과. 커밋:
```bash
git add ai/app/db.py ai/app/etl/visa_reclassify.py ai/app/etl/jobs.py ai/app/routes/etl.py
git commit -m "feat(ai-visa): unclear 재분류 패스(키워드→LLM→회사) + ETL 훅 + /etl/reclassify-visa"
```

---

## Task 4: 백필 + 라이브 검증 (오케스트레이터 수행)
- [ ] devjobs 복제(pg_dump|psql → devjobs_visatest). 워크트리 ai/.env 복사(키), DATABASE_URL=devjobs_visatest 로 AI(8002) 기동.
- [ ] `POST /internal/etl/reclassify-visa` 호출 → 재분류. before/after `visa_status` 분포 비교(unclear 감소량) + 재분류된 공고 몇 건 spot-check(원문 vs 새 status/evidence 타당성).
- [ ] 결과 양호하면 실 devjobs 에도 적용할지 판단(사용자 확인).

## Self-Review
- 키워드 확장(고신뢰만, T1) + LLM(키 없으면 None, T2) + 회사 추론(보수적·투명, T3) + 훅/엔드포인트 ✓. unclear만 대상, 설명 캐시, 동시성 8. update_visa 는 Json 래핑(upsert와 동일). 백엔드/프론트/마이그레이션 무변경. MCP 미러 키워드 동기화. 신규 ingest는 ETL 사이클 끝에 자동 재분류.
