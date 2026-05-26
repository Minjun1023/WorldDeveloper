# ATS 확장 (SmartRecruiters) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SmartRecruiters 공개 API 커넥터를 추가하고 ETL/dedup 에 배선해, 회사 ATS 직접 수집(신뢰도 높은 공고)을 확장한다.

**Architecture:** 기존 ATS 커넥터 패턴(`async def fetch(token, limit) -> list[JobPosting]`) + 순수 파서(`_parse_list`, `_to_posting`)로 네트워크 모킹 없이 테스트. SmartRecruiters 목록엔 설명·apply URL 이 없어 공고당 상세 1콜로 보강. 회사 토큰은 라이브 검증 후 등록.

**Tech Stack:** Python 3.13, httpx, pytest + pytest-asyncio. 임베딩 로컬·룰베이스 적재라 추가 비용 0.

**전제:**
- 경로 `ai/` 기준. 테스트: `cd /Users/mac/WordDeveloper/WorldDeveloper/ai && uv run pytest tests/<file> -v`.
- 브랜치 `feat/ats-expansion`(base origin/main `1b3988e` — job-coverage 기능 포함: `dedup.py`, `filter.py`, `sources/{adzuna,weworkremotely}.py`).
- 기존 ATS 커넥터: `sources/{greenhouse,lever,ashby}.py`. ETL: `app/etl/jobs.py` 의 `ATS_FETCHERS` dict.
- `dedup._SOURCE_PRIORITY` 현재: greenhouse/lever/ashby:3, remoteok/arbeitnow/wwr:2, adzuna:1.
- SmartRecruiters 공개 API 라이브 검증 완료(토큰 `Visa` 동작). 스펙: `docs/superpowers/specs/2026-05-26-ats-expansion-design.md`.
- 커밋은 명시 파일만 stage. `.env`·`.claude/` 절대 add 금지.

---

### Task 1: SmartRecruiters 커넥터

**Files:**
- Create: `ai/dev_jobs_core/sources/smartrecruiters.py`
- Test: `ai/tests/test_smartrecruiters.py`

- [ ] **Step 1: 실패 테스트 작성** — `ai/tests/test_smartrecruiters.py` (샘플은 실제 Visa 응답 형태 기반):

```python
from dev_jobs_core.sources import smartrecruiters as sr

LIST_PAYLOAD = {
    "offset": 0, "limit": 100, "totalFound": 1,
    "content": [
        {
            "id": "744000122509268",
            "name": "Sr. SW Engineer",
            "company": {"identifier": "Visa", "name": "Visa"},
            "releasedDate": "2026-04-23T16:54:54.835Z",
            "location": {"city": "Austin", "region": "TX", "country": "us",
                         "remote": False, "fullLocation": "Austin, TX, United States"},
            "typeOfEmployment": {"label": "Full-time"},
            "ref": "https://api.smartrecruiters.com/v1/companies/Visa/postings/744000122509268",
        },
        {"name": "no id — skipped"},
    ],
}

DETAIL_PAYLOAD = {
    "id": "744000122509268",
    "applyUrl": "https://jobs.smartrecruiters.com/Visa/744000122509268-sr-sw-engineer",
    "postingUrl": "https://jobs.smartrecruiters.com/Visa/744000122509268",
    "jobAd": {"sections": {
        "jobDescription": {"title": "Job Description", "text": "<p>Design and build systems.</p>"},
        "qualifications": {"title": "Qualifications", "text": "<p>5+ years.</p>"},
    }},
}


def test_parse_list_returns_content():
    assert len(sr._parse_list(LIST_PAYLOAD)) == 2
    assert sr._parse_list({}) == []


def test_to_posting_maps_fields_with_detail():
    item = LIST_PAYLOAD["content"][0]
    p = sr._to_posting("Visa", item, DETAIL_PAYLOAD)
    assert p is not None
    assert p.job_id == "smartrecruiters:Visa:744000122509268"
    assert p.source == "smartrecruiters"
    assert p.title == "Sr. SW Engineer"
    assert p.company == "Visa"
    assert p.location == "Austin, TX, United States"
    assert p.is_remote is False
    assert p.employment_type == "Full-time"
    assert "Design and build" in p.description
    assert "5+ years" in p.description
    assert p.apply_url == "https://jobs.smartrecruiters.com/Visa/744000122509268-sr-sw-engineer"
    assert p.posted_at == "2026-04-23T16:54:54.835Z"


def test_to_posting_skips_without_id():
    assert sr._to_posting("Visa", {"name": "x"}, None) is None


def test_to_posting_detail_none_falls_back_apply_url():
    item = LIST_PAYLOAD["content"][0]
    p = sr._to_posting("Visa", item, None)
    assert p.description == ""
    assert p.apply_url == "https://jobs.smartrecruiters.com/Visa/744000122509268"
```

- [ ] **Step 2: 실패 확인**

Run: `cd /Users/mac/WordDeveloper/WorldDeveloper/ai && uv run pytest tests/test_smartrecruiters.py -v`
Expected: FAIL (`ModuleNotFoundError: dev_jobs_core.sources.smartrecruiters`)

- [ ] **Step 3: 구현** — `ai/dev_jobs_core/sources/smartrecruiters.py`:

```python
"""SmartRecruiters 공개 Posting API (무료, 키 불필요). 회사별 공고 수집.

목록 응답엔 설명·사용자 apply URL 이 없어, 공고당 상세 1콜로 보강한다.
"""
from __future__ import annotations

import httpx

from ..models import JobPosting

BASE = "https://api.smartrecruiters.com/v1/companies"


def _parse_list(payload: dict) -> list[dict]:
    return payload.get("content", []) or []


def _section_text(detail: dict, key: str) -> str:
    sections = (detail.get("jobAd") or {}).get("sections") or {}
    return (sections.get(key) or {}).get("text") or ""


def _to_posting(token: str, item: dict, detail: dict | None) -> JobPosting | None:
    jid = item.get("id")
    if not jid:
        return None
    detail = detail or {}
    loc = item.get("location") or {}
    location = loc.get("fullLocation") or " ".join(
        x for x in [loc.get("city"), loc.get("country")] if x
    )
    description = "\n".join(
        t for t in [_section_text(detail, "jobDescription"),
                    _section_text(detail, "qualifications")] if t
    )
    apply_url = (detail.get("applyUrl") or detail.get("postingUrl")
                 or f"https://jobs.smartrecruiters.com/{token}/{jid}")
    return JobPosting(
        job_id=f"smartrecruiters:{token}:{jid}",
        source="smartrecruiters",
        title=item.get("name", "") or "",
        company=(item.get("company") or {}).get("name", "") or token,
        location=location,
        is_remote=bool(loc.get("remote")),
        employment_type=(item.get("typeOfEmployment") or {}).get("label", "") or "",
        description=description,
        apply_url=apply_url,
        posted_at=str(item.get("releasedDate", "") or ""),
    )


async def fetch(token: str, limit: int = 20) -> list[JobPosting]:
    postings: list[JobPosting] = []
    async with httpx.AsyncClient(timeout=30, headers={"User-Agent": "dev-jobs/0.1"}) as client:
        resp = await client.get(f"{BASE}/{token}/postings",
                                params={"limit": limit, "offset": 0})
        resp.raise_for_status()
        items = _parse_list(resp.json())[:limit]
        for item in items:
            jid = item.get("id")
            detail = None
            if jid:
                try:
                    dr = await client.get(f"{BASE}/{token}/postings/{jid}")
                    dr.raise_for_status()
                    detail = dr.json()
                except Exception:
                    detail = None
            p = _to_posting(token, item, detail)
            if p:
                postings.append(p)
    return postings
```

- [ ] **Step 4: 통과 확인**

Run: `cd /Users/mac/WordDeveloper/WorldDeveloper/ai && uv run pytest tests/test_smartrecruiters.py -v`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
cd /Users/mac/WordDeveloper/WorldDeveloper
git add ai/dev_jobs_core/sources/smartrecruiters.py ai/tests/test_smartrecruiters.py
git commit -m "feat(jobs): SmartRecruiters 소스 커넥터 (목록+상세)"
```

---

### Task 2: dedup 소스 우선순위에 smartrecruiters 추가

**Files:**
- Modify: `ai/dev_jobs_core/dedup.py`
- Modify: `ai/tests/test_dedup.py`

- [ ] **Step 1: 실패 테스트 추가** — `ai/tests/test_dedup.py` 에 추가:

```python
def test_smartrecruiters_beats_aggregator():
    adz = _p("adzuna:us:9", "adzuna", "Visa", "Backend Engineer", "Austin")
    smr = _p("smartrecruiters:Visa:5", "smartrecruiters", "Visa", "Backend Engineer", "Austin")
    out = dedup([adz, smr])
    assert len(out) == 1
    assert out[0].source == "smartrecruiters"
```

(`_p` 헬퍼는 기존 test_dedup.py 에 이미 있음.)

- [ ] **Step 2: 실패 확인**

Run: `cd /Users/mac/WordDeveloper/WorldDeveloper/ai && uv run pytest tests/test_dedup.py::test_smartrecruiters_beats_aggregator -v`
Expected: FAIL (smartrecruiters 우선순위 0 → adzuna(1) 가 이겨서 source 가 adzuna)

- [ ] **Step 3: 구현** — `ai/dev_jobs_core/dedup.py` 의 `_SOURCE_PRIORITY` 에 smartrecruiters 추가:

```python
_SOURCE_PRIORITY = {
    "greenhouse": 3, "lever": 3, "ashby": 3, "smartrecruiters": 3,
    "remoteok": 2, "arbeitnow": 2, "wwr": 2,
    "adzuna": 1,
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd /Users/mac/WordDeveloper/WorldDeveloper/ai && uv run pytest tests/test_dedup.py -v`
Expected: PASS (기존 3 + 신규 1 = 4 tests)

- [ ] **Step 5: 커밋**

```bash
cd /Users/mac/WordDeveloper/WorldDeveloper
git add ai/dev_jobs_core/dedup.py ai/tests/test_dedup.py
git commit -m "feat(jobs): dedup 우선순위에 smartrecruiters(ATS) 추가"
```

---

### Task 3: ETL 배선 (ATS_FETCHERS)

**Files:**
- Modify: `ai/app/etl/jobs.py`

- [ ] **Step 1: import + ATS_FETCHERS 수정** (파일을 먼저 읽을 것)

import 에 `smartrecruiters` 추가 — 기존 sources import 줄을 다음으로 교체:
```python
from dev_jobs_core.sources import adzuna, arbeitnow, ashby, greenhouse, lever, remoteok, smartrecruiters, weworkremotely
```
`ATS_FETCHERS` dict 에 한 줄 추가:
```python
ATS_FETCHERS = {
    "greenhouse": greenhouse.fetch,
    "lever": lever.fetch,
    "ashby": ashby.fetch,
    "smartrecruiters": smartrecruiters.fetch,
}
```
(기존 ATS 루프가 registry 의 `ats == "smartrecruiters"` 회사를 자동 포함. 다른 로직 변경 불필요 — 필터/dedup 은 이미 일괄 적용.)

- [ ] **Step 2: import + 전체 테스트 회귀 확인**

Run: `cd /Users/mac/WordDeveloper/WorldDeveloper/ai && uv run python -c "import app.etl.jobs; print('etl import ok')" && uv run pytest tests/ -q`
Expected: `etl import ok` + 전체 PASS(기존 + smartrecruiters + dedup 신규).

- [ ] **Step 3: 커밋**

```bash
cd /Users/mac/WordDeveloper/WorldDeveloper
git add ai/app/etl/jobs.py
git commit -m "feat(jobs): ETL ATS_FETCHERS 에 smartrecruiters 등록"
```

---

### Task 4: 회사 레지스트리 확장 (라이브 검증 후 등록)

**Files:**
- Modify: `ai/dev_jobs_core/data/companies.json`

목표: SmartRecruiters 를 쓰는 **공개 공고가 실제로 있는** 회사를 등록. 토큰은 회사 식별자(대소문자 구분)이고 회사마다 공개 공고 유무가 달라, **반드시 라이브로 검증**한 뒤 추가한다.

- [ ] **Step 1: 후보 토큰 라이브 검증**

다음 명령으로 후보 SmartRecruiters 토큰의 공개 공고 수를 확인하고, **`totalFound > 0` 인 것만** 채택:
```bash
for t in Visa Bosch Ubisoft IKEA Tide McDonalds Skydio Klarna Avaloq SecurityScorecard FreeNow Bitpanda LinkedIn Twilio Square; do
  n=$(curl -s -m 8 "https://api.smartrecruiters.com/v1/companies/$t/postings?limit=1" 2>/dev/null | python3 -c "import sys,json;print(json.load(sys.stdin).get('totalFound','ERR'))" 2>/dev/null)
  echo "$t: $n"
done
```
(추가 후보를 자유롭게 더 시도해도 됨. 알려진 SmartRecruiters 사용 대기업 위주. `Visa` 는 확인됨.)

- [ ] **Step 2: 검증된 회사만 `companies.json` 에 추가**

`ai/dev_jobs_core/data/companies.json` 에 `totalFound > 0` 으로 확인된 회사들을 항목으로 추가(기존 형식 유지). 예(Visa 는 확실, 나머지는 Step 1 결과로 대체):
```json
  "visa":     {"ats": "smartrecruiters", "token": "Visa",     "tags": ["fintech", "payments"]},
```
- 최소 `Visa` 1곳은 반드시 포함. Step 1 에서 `totalFound>0` 인 회사를 모두 추가(목표 5곳 이상).
- 0건/ERR 토큰은 추가하지 말 것(클러터 방지).
- JSON 문법 유효성 확인: `cd /Users/mac/WordDeveloper/WorldDeveloper/ai && uv run python -c "import json; json.load(open('dev_jobs_core/data/companies.json')); print('json ok')"`

- [ ] **Step 3: registry 로드 확인**

Run: `cd /Users/mac/WordDeveloper/WorldDeveloper/ai && uv run python -c "from dev_jobs_core import registry; n=[c for c in registry.list_all() if c['ats']=='smartrecruiters']; print('smartrecruiters 회사:', len(n), [c['token'] for c in n])"`
Expected: 추가한 SmartRecruiters 회사들이 출력됨(Visa 포함).

- [ ] **Step 4: 커밋**

```bash
cd /Users/mac/WordDeveloper/WorldDeveloper
git add ai/dev_jobs_core/data/companies.json
git commit -m "feat(jobs): companies.json 에 검증된 SmartRecruiters 회사 추가"
```

---

### Task 5: 라이브 롤아웃 + 측정 (코드 변경 없음)

**Files:** 없음

- [ ] **Step 1: 인프라 기동 + ETL 1회 실행**

```bash
cd /Users/mac/WordDeveloper/WorldDeveloper && docker compose up -d postgres
cd ai && uv run python -c "
import asyncio, json
from app.etl.jobs import run_full_cycle
print(json.dumps(asyncio.run(run_full_cycle()), ensure_ascii=False, indent=2))
"
```
Expected: 통계에 ATS 수집 증가(`ats_jobs` 증가), 에러 없이 완료. (키 불필요 — 전부 무료 소스.)

- [ ] **Step 2: 소스별 활성 공고 측정**

```bash
docker exec dev-jobs-postgres psql -U devjobs -d devjobs -c "SELECT source, count(*) FROM jobs WHERE is_active GROUP BY source ORDER BY 2 DESC; SELECT count(*) AS active_total FROM jobs WHERE is_active;"
```
Expected: `smartrecruiters` 소스 행 등장, active_total 증가.

- [ ] **Step 3: 0건 회사 정리(필요 시)**

ETL 로그에서 공고 0건이거나 실패한 SmartRecruiters 회사가 있으면 `companies.json` 에서 제거하고 재커밋. (선택: 더 많은 회사를 Task 4 Step 1 방식으로 검증해 추가하며 반복.)

- [ ] **Step 4: 결과 기록**

소스별 분포·active_total 증가를 PR 설명에 기록.

---

## Self-Review (작성자 점검)

**Spec coverage:**
- SmartRecruiters 커넥터(스펙 §A, 목록+상세) → Task 1 ✓
- dedup smartrecruiters:3(§C) → Task 2 ✓
- ETL ATS_FETCHERS(§C) → Task 3 ✓
- 레지스트리 확장 + 롤아웃 토큰 검증(§B) → Task 4 ✓
- 테스트 + 라이브 롤아웃(§D) → Task 1·2 테스트 + Task 5 ✓
- Workable 은 스펙상 비범위(후속) → 의도적 제외, 태스크 없음.

**Placeholder scan:** 없음. 코드 단계는 전체 본문. Task 4 후보 토큰은 라이브 검증 절차(명령 포함)로 처리 — 추측 토큰을 코드에 박지 않음.

**Type consistency:** `smartrecruiters.fetch(token, limit)` (Task 1) 은 ETL `ATS_FETCHERS` 호출(`_fetch_ats_company` 가 `fn(token, limit=limit)`)과 호환. `source="smartrecruiters"`(Task 1) 가 dedup `_SOURCE_PRIORITY`(Task 2)·companies.json `ats`(Task 4)와 일치. `_parse_list`/`_to_posting` 시그니처가 테스트와 일치.
