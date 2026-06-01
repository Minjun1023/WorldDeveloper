# 원격 적격(remote_eligibility) 데이터 축 — Phase 1 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 원격 공고를 "한국 거주자가 지원 가능한 권역인가"로 분류하는 데이터 축을 ETL에 추가하고, 한국인에게 확정적으로 막힌 공고를 적재 단계에서 드롭한다.

**Architecture:** `visa.py` 분석기 패턴을 그대로 미러한 순수 함수 분석기(`remote_geo.py`)가 `(status, evidence)`를 반환한다. `transform.py`가 이를 호출해 `job_row`에 저장하고, `db.py`의 `upsert_job`이 새 컬럼(V10 마이그레이션)에 기록한다. `viability.py`의 순수 함수 `is_dead_end`가 ETL 루프에서 확정 막힘 공고를 걸러낸다. 이번 Phase는 데이터 축만 — 백엔드 조회(Phase 2)·웹 UI(Phase 3)는 별도 계획.

**Tech Stack:** Python 3.12 (pytest, ruff), Postgres (Flyway 마이그레이션), 작업 경로 `/Users/mac/WordDeveloper/WorldDeveloper/`.

**관련 spec:** `docs/superpowers/specs/2026-06-01-korea-viability-remote-eligibility-design.md`

**전체 테스트 실행 명령 (자주 사용):**
```bash
cd /Users/mac/WordDeveloper/WorldDeveloper/ai && .venv/bin/python -m pytest tests/ -q
```

---

### Task 1: `remote_geo` 분석기 (크럭스)

순수 함수 분석기. location/description 텍스트에서 한국 지원 가능 권역을 분류한다. 우선순위: 명시적 lock-out(강한 한정 표현) → worldwide → apac → location 권역 토큰 → unclear.

**Files:**
- Create: `ai/dev_jobs_core/analyzers/remote_geo.py`
- Test: `ai/tests/test_remote_geo.py`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `ai/tests/test_remote_geo.py`:

```python
from dev_jobs_core.analyzers.remote_geo import classify_remote_eligibility as cls


def test_not_remote_returns_none():
    assert cls("New York, US", False, "")[0] is None


def test_worldwide_location():
    assert cls("Remote - Worldwide", True, "")[0] == "worldwide"


def test_work_from_anywhere_in_description():
    assert cls("Remote", True, "You can work from anywhere.")[0] == "worldwide"


def test_apac_region():
    assert cls("Remote - APAC", True, "")[0] == "apac_ok"


def test_korea_location():
    assert cls("Seoul, South Korea", True, "")[0] == "apac_ok"


def test_us_location_restricted():
    assert cls("Remote (US)", True, "")[0] == "region_restricted"


def test_europe_location_restricted():
    assert cls("Remote, Europe", True, "")[0] == "region_restricted"


def test_japan_single_country_restricted():
    # 특정 다른 APAC 국가 단독은 한국 제외 → restricted
    assert cls("Tokyo, Japan", True, "")[0] == "region_restricted"


def test_strong_phrase_beats_worldwide():
    # 명시적 lock-out 은 worldwide 신호가 있어도 이긴다 (헛된 희망 방지)
    assert cls("Remote - Worldwide", True, "You must be based in the US.")[0] == "region_restricted"


def test_timezone_overlap_restricted():
    assert cls("Remote", True, "Requires overlap with US timezone.")[0] == "region_restricted"


def test_bare_remote_unclear():
    # 권역 명시 없는 원격은 worldwide 로 추정하지 않고 정직하게 unclear
    assert cls("Remote", True, "Great team, Python and Go.")[0] == "unclear"


def test_empty_location_unclear():
    assert cls("", True, "")[0] == "unclear"


def test_evidence_returned():
    status, ev = cls("Remote (US)", True, "")
    assert status == "region_restricted"
    assert len(ev) >= 1
```

- [ ] **Step 2: 테스트 실패 확인**

Run:
```bash
cd /Users/mac/WordDeveloper/WorldDeveloper/ai && .venv/bin/python -m pytest tests/test_remote_geo.py -q
```
Expected: FAIL — `ModuleNotFoundError: No module named 'dev_jobs_core.analyzers.remote_geo'`

- [ ] **Step 3: 분석기 구현**

Create `ai/dev_jobs_core/analyzers/remote_geo.py`:

```python
"""원격 공고의 한국 거주자 지원 가능 권역을 분류. analyzers/visa.py 미러.

분류 결과:
- worldwide         : 전 세계 원격 (한국 포함) → 지원 가능
- apac_ok           : APAC/아시아 광역 (한국 포함) → 지원 가능
- region_restricted : 특정 비-한국 권역 한정 (한국 제외) → 지원 불가
- unclear           : 원격이지만 권역 명시 없음 (worldwide 추정 금지 — 정직)
- None              : 원격 아님(온사이트)

주의: 키워드 매칭이라 100% 정확하지 않다. 모호하면 worldwide 가 아니라
unclear 로 둔다. 최종 노출 판단은 조회 계층(viable 게이트)이 한다.
"""
from __future__ import annotations

import re

# location 필드에 등장하면 비-한국 권역 한정으로 보는 토큰.
# (location 은 짧고 큐레이션된 필드라 권역명 자체가 한정 신호. description 본문엔 적용 안 함.)
_LOC_RESTRICT = [
    r"\bU\.?S\.?A?\b", r"\bUnited States\b", r"\bAmericas?\b", r"\bNorth America\b",
    r"\bLATAM\b", r"\bLatin America\b", r"\bEMEA\b", r"\bEU\b", r"\bEurope(?:an)?\b",
    r"\bU\.?K\.?\b", r"\bUnited Kingdom\b", r"\bCanada\b", r"\bAustralia\b", r"\bJapan\b",
]

# location/description 어디서든 명시적 lock-out 으로 보는 강한 한정 표현.
_STRONG_RESTRICT = [
    r"\bmust be (?:based|located) in\b",
    r"\b(?:authorized|eligible) to work in\b",
    r"\bresidents? of\b",
    r"\b(?:US|U\.S\.|USA|EU|UK|EMEA|Europe(?:an)?|Americas?|Canada|Australia)[-\s]?only\b",
    r"\b(?:US|U\.S\.|USA|EU|UK|EMEA|Europe(?:an)?)[-\s]?based\b",
    r"\boverlap with (?:US|U\.S\.|Europe|EST|PST|CET)\b",
    r"\b(?:PST|EST|CET) (?:time\s*zone|hours)\b",
    r"\b(?:US|European) time\s*zone\b",
]

# worldwide (한국 포함) 긍정 신호.
_WORLDWIDE = [
    r"\bworld[\s-]?wide\b", r"\bwork from anywhere\b", r"\bremote anywhere\b",
    r"\banywhere in the world\b", r"\bany location\b", r"\bany time\s*zone\b",
    r"\bglobally remote\b", r"\bglobal remote\b", r"\bremote\s*[-,:]\s*global\b",
]

# APAC/아시아 광역 (한국 포함) 신호.
_APAC = [
    r"\bAPAC\b", r"\basia[\s-]?pacific\b", r"\basia\b", r"\b(?:south )?korea\b",
    r"\bseoul\b", r"\bKST\b", r"\basia time\s*zone\b",
]

_LOC_RESTRICT_RE = [re.compile(p, re.I) for p in _LOC_RESTRICT]
_STRONG_RESTRICT_RE = [re.compile(p, re.I) for p in _STRONG_RESTRICT]
_WORLDWIDE_RE = [re.compile(p, re.I) for p in _WORLDWIDE]
_APAC_RE = [re.compile(p, re.I) for p in _APAC]


def _hits(text: str, patterns: list[re.Pattern]) -> list[str]:
    out: list[str] = []
    for pat in patterns:
        m = pat.search(text)
        if m:
            out.append(m.group(0))
    return out


def classify_remote_eligibility(
    location: str, is_remote: bool, description: str
) -> tuple[str | None, list[str]]:
    """(status, evidence) 반환. 원격이 아니면 (None, [])."""
    if not is_remote:
        return None, []
    loc = location or ""
    desc = description or ""
    blob = f"{loc}\n{desc}"

    strong = _hits(blob, _STRONG_RESTRICT_RE)
    if strong:  # 명시적 lock-out 이 최우선 (worldwide 신호보다 강함)
        return "region_restricted", strong[:3]

    worldwide = _hits(blob, _WORLDWIDE_RE)
    if worldwide:
        return "worldwide", worldwide[:3]

    apac = _hits(blob, _APAC_RE)
    if apac:
        return "apac_ok", apac[:3]

    loc_restrict = _hits(loc, _LOC_RESTRICT_RE)
    if loc_restrict:
        return "region_restricted", loc_restrict[:3]

    return "unclear", []
```

- [ ] **Step 4: 테스트 통과 확인**

Run:
```bash
cd /Users/mac/WordDeveloper/WorldDeveloper/ai && .venv/bin/python -m pytest tests/test_remote_geo.py -q
```
Expected: PASS (13 passed)

- [ ] **Step 5: 커밋**

```bash
cd /Users/mac/WordDeveloper/WorldDeveloper
git add ai/dev_jobs_core/analyzers/remote_geo.py ai/tests/test_remote_geo.py
git commit -m "feat(etl): add remote_eligibility analyzer (KR-resident geo eligibility)"
```

---

### Task 2: V10 마이그레이션 — jobs 테이블에 컬럼 추가

`visa_status`/`visa_evidence` 컬럼을 미러. Flyway 가 백엔드 부팅/백엔드 테스트 시 자동 적용한다.

**Files:**
- Create: `backend/src/main/resources/db/migration/V10__job_remote_eligibility.sql`

- [ ] **Step 1: 마이그레이션 SQL 작성**

Create `backend/src/main/resources/db/migration/V10__job_remote_eligibility.sql`:

```sql
-- 원격 공고의 한국 거주자 지원 가능 권역.
-- worldwide / apac_ok / region_restricted / unclear / NULL(원격 아님)
ALTER TABLE jobs ADD COLUMN remote_eligibility TEXT;
ALTER TABLE jobs ADD COLUMN remote_evidence    JSONB;

-- viable 필터 + remote 티어 정렬용 (visa 인덱스 idx_jobs_visa_loc_posted 미러)
CREATE INDEX idx_jobs_remote_elig_posted ON jobs (remote_eligibility, posted_at DESC);
```

- [ ] **Step 2: SQL 검증 (파일 존재 + 버전 연속성 확인)**

Run:
```bash
cd /Users/mac/WordDeveloper/WorldDeveloper && ls backend/src/main/resources/db/migration/ | tail -3
```
Expected: `V8__...`, `V9__job_search_tsv.sql`, `V10__job_remote_eligibility.sql` 가 보임. (V10 이 최신, 버전 연속)

> 적용 검증: Flyway 는 백엔드 부팅 또는 백엔드 테스트 실행 시 마이그레이션을 올린다. 실제 적용은 Phase 2(백엔드) 테스트에서 자동 검증된다. 이 Phase 에서는 SQL 작성·버전 연속성까지만.

- [ ] **Step 3: 커밋**

```bash
cd /Users/mac/WordDeveloper/WorldDeveloper
git add backend/src/main/resources/db/migration/V10__job_remote_eligibility.sql
git commit -m "feat(db): V10 add remote_eligibility + remote_evidence columns"
```

---

### Task 3: `is_dead_end` viability 게이트 (순수 함수)

ETL 루프에서 확정 막힘 공고를 거를 판정 함수. **확정 부정만** — `unclear` 는 절대 dead_end 가 아니다(레지스터/분류 개선 시 살아날 수 있으므로). 무거운 ETL 모듈과 분리해 단독 테스트 가능하게 별도 파일로 둔다.

**Files:**
- Create: `ai/app/etl/viability.py`
- Test: `ai/tests/test_viability.py`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `ai/tests/test_viability.py`:

```python
from app.etl.viability import is_dead_end


def test_no_sponsor_onsite_is_dead_end():
    assert is_dead_end("no_sponsor", False, None) is True


def test_no_sponsor_region_restricted_is_dead_end():
    assert is_dead_end("no_sponsor", True, "region_restricted") is True


def test_no_sponsor_but_worldwide_remote_is_viable():
    assert is_dead_end("no_sponsor", True, "worldwide") is False


def test_no_sponsor_but_apac_remote_is_viable():
    assert is_dead_end("no_sponsor", True, "apac_ok") is False


def test_no_sponsor_remote_unclear_not_dead_end():
    # unclear 는 절대 드롭하지 않는다 (기본 숨김은 조회 계층에서)
    assert is_dead_end("no_sponsor", True, "unclear") is False


def test_sponsors_never_dead_end():
    assert is_dead_end("sponsors", False, None) is False


def test_unclear_visa_never_dead_end():
    assert is_dead_end("unclear", False, None) is False
```

- [ ] **Step 2: 테스트 실패 확인**

Run:
```bash
cd /Users/mac/WordDeveloper/WorldDeveloper/ai && .venv/bin/python -m pytest tests/test_viability.py -q
```
Expected: FAIL — `ModuleNotFoundError: No module named 'app.etl.viability'`

- [ ] **Step 3: 구현**

Create `ai/app/etl/viability.py`:

```python
"""한국인 취업 가능성(viability) 게이트.

한국인이 실제로 취할 수 있는 공고:
    visa_status == 'sponsors'  (이주 가능)
    OR remote_eligibility in ('worldwide', 'apac_ok')  (한국서 원격 가능)

ETL 적재 단계에서는 그 반대 극단, 즉 '확정적으로 막힌' 공고만 드롭한다.
unclear(판정 불가)는 절대 드롭하지 않는다 — 기본 숨김 처리는 조회 계층의 몫.
"""
from __future__ import annotations


def is_dead_end(
    visa_status: str | None, is_remote: bool, remote_eligibility: str | None
) -> bool:
    """확정적으로 한국인에게 길이 막힌 공고면 True (적재 드롭 대상).

    비자가 명시적으로 거부(no_sponsor)이고, 동시에 원격으로도 한국이 막혔을 때만.
    """
    if visa_status != "no_sponsor":
        return False
    return (not is_remote) or remote_eligibility == "region_restricted"
```

- [ ] **Step 4: 테스트 통과 확인**

Run:
```bash
cd /Users/mac/WordDeveloper/WorldDeveloper/ai && .venv/bin/python -m pytest tests/test_viability.py -q
```
Expected: PASS (7 passed)

- [ ] **Step 5: 커밋**

```bash
cd /Users/mac/WordDeveloper/WorldDeveloper
git add ai/app/etl/viability.py ai/tests/test_viability.py
git commit -m "feat(etl): add is_dead_end viability gate (confirmed-blocked only)"
```

---

### Task 4: ETL 배선 — transform + upsert_job + 적재 루프 드롭

분석기를 변환에 연결하고, 새 컬럼을 DB에 기록하고, 적재 루프에서 dead_end 를 드롭한다. 이 세 변경은 한 묶음이어야 한다(transform 이 새 키를 넣으면 upsert_job 이 그 키를 INSERT 하므로).

**Files:**
- Modify: `ai/app/etl/transform.py:13` (import), `ai/app/etl/transform.py:74` (호출), `ai/app/etl/transform.py:79-98` (job_row)
- Modify: `ai/app/db.py:42-80` (upsert_job)
- Modify: `ai/app/etl/jobs.py:32` (import), `ai/app/etl/jobs.py:135-147` (루프 드롭), `ai/app/etl/jobs.py:158-168` (result)

- [ ] **Step 1: transform.py — 분석기 import 추가**

`ai/app/etl/transform.py` 13번 줄 (`from dev_jobs_core.analyzers.visa import classify_visa`) 바로 아래에 추가:

```python
from dev_jobs_core.analyzers.remote_geo import classify_remote_eligibility
```

- [ ] **Step 2: transform.py — 분류 호출 추가**

`ai/app/etl/transform.py` 74번 줄 (`status, evidence = classify_visa(j.description)`) 바로 아래에 추가:

```python
    remote_status, remote_evidence = classify_remote_eligibility(
        j.location or "", bool(j.is_remote), j.description or ""
    )
```

- [ ] **Step 3: transform.py — job_row 에 키 추가**

`ai/app/etl/transform.py` 의 `job_row` 딕셔너리에서 `"visa_evidence": evidence,` 줄(96번 부근) 바로 아래에 추가:

```python
        "remote_eligibility": remote_status,
        "remote_evidence": remote_evidence,
```

- [ ] **Step 4: db.py — upsert_job 에 새 컬럼 배선**

`ai/app/db.py` 의 `upsert_job` 을 수정한다. 세 군데:

(a) 45번 줄 `params["visa_evidence"] = Json(job.get("visa_evidence") or [])` 아래에 추가:
```python
    params["remote_evidence"] = Json(job.get("remote_evidence") or [])
```

(b) INSERT 컬럼 목록과 VALUES 를 수정. 기존:
```python
            salary_min_usd, salary_max_usd, visa_status, visa_evidence, embedding,
            first_seen_at, last_seen_at, is_active
        ) VALUES (
            %(id)s, %(source)s, %(title)s, %(company_slug)s, %(location)s, %(is_remote)s,
            %(employment_type)s, %(description)s, %(description_text)s, %(apply_url)s,
            %(posted_at)s, %(closes_at)s, %(tags)s, %(salary_min_usd)s, %(salary_max_usd)s,
            %(visa_status)s, %(visa_evidence)s, %(embedding)s,
            now(), now(), true
        )
```
변경 후:
```python
            salary_min_usd, salary_max_usd, visa_status, visa_evidence,
            remote_eligibility, remote_evidence, embedding,
            first_seen_at, last_seen_at, is_active
        ) VALUES (
            %(id)s, %(source)s, %(title)s, %(company_slug)s, %(location)s, %(is_remote)s,
            %(employment_type)s, %(description)s, %(description_text)s, %(apply_url)s,
            %(posted_at)s, %(closes_at)s, %(tags)s, %(salary_min_usd)s, %(salary_max_usd)s,
            %(visa_status)s, %(visa_evidence)s,
            %(remote_eligibility)s, %(remote_evidence)s, %(embedding)s,
            now(), now(), true
        )
```

(c) ON CONFLICT DO UPDATE SET 에서 `visa_evidence   = EXCLUDED.visa_evidence,` 줄 아래에 추가:
```python
            remote_eligibility = EXCLUDED.remote_eligibility,
            remote_evidence    = EXCLUDED.remote_evidence,
```

- [ ] **Step 5: jobs.py — is_dead_end import 추가**

`ai/app/etl/jobs.py` 32번 줄 (`from .visa_reclassify import reclassify_unclear_visa`) 위에 추가:

```python
from .viability import is_dead_end
```

- [ ] **Step 6: jobs.py — 적재 루프에 드롭 적용**

`ai/app/etl/jobs.py` 135번 줄 부근 `upserted = 0` / `failed = 0` 아래에 카운터 추가:
```python
    dropped_dead_end = 0
```

그리고 139~147번 루프를 수정. 기존:
```python
        for p in unique_list:
            try:
                company_row, job_row = transform(p)
                upsert_company(conn, company_row)
                upsert_job(conn, job_row)
                upserted += 1
            except Exception as e:  # noqa: BLE001 — 한 공고 실패가 전체를 막지 않도록
                failed += 1
                log.warning("upsert 실패 %s: %s", p.job_id, e)
```
변경 후:
```python
        for p in unique_list:
            try:
                company_row, job_row = transform(p)
                if is_dead_end(
                    job_row["visa_status"], job_row["is_remote"], job_row["remote_eligibility"]
                ):
                    dropped_dead_end += 1
                    continue
                upsert_company(conn, company_row)
                upsert_job(conn, job_row)
                upserted += 1
            except Exception as e:  # noqa: BLE001 — 한 공고 실패가 전체를 막지 않도록
                failed += 1
                log.warning("upsert 실패 %s: %s", p.job_id, e)
```

- [ ] **Step 7: jobs.py — result 통계에 드롭 수 추가**

`ai/app/etl/jobs.py` 의 `result` 딕셔너리에서 `"upserted": upserted,` 줄 아래에 추가:
```python
        "dropped_dead_end": dropped_dead_end,
```

- [ ] **Step 8: 전체 테스트 스위트 통과 확인 (회귀 없음)**

Run:
```bash
cd /Users/mac/WordDeveloper/WorldDeveloper/ai && .venv/bin/python -m pytest tests/ -q
```
Expected: PASS — 기존 테스트 전부 그린 + 신규 test_remote_geo(13) + test_viability(7).

- [ ] **Step 9: import 스모크 체크 (배선 무결성)**

transform/jobs 모듈이 새 import 와 함께 정상 로드되는지 확인:
```bash
cd /Users/mac/WordDeveloper/WorldDeveloper/ai && .venv/bin/python -c "from app.etl.transform import transform; from app.etl.jobs import is_dead_end, run_full_cycle; print('imports ok')"
```
Expected: `imports ok`

- [ ] **Step 10: ruff 린트 통과 확인**

Run:
```bash
cd /Users/mac/WordDeveloper/WorldDeveloper/ai && .venv/bin/python -m ruff check app/etl/transform.py app/etl/jobs.py app/etl/viability.py app/db.py dev_jobs_core/analyzers/remote_geo.py
```
Expected: `All checks passed!`

- [ ] **Step 11: 커밋**

```bash
cd /Users/mac/WordDeveloper/WorldDeveloper
git add ai/app/etl/transform.py ai/app/db.py ai/app/etl/jobs.py
git commit -m "feat(etl): wire remote_eligibility into transform/upsert + drop dead-end jobs"
```

---

## Phase 1 완료 기준

- `remote_geo` 분석기가 5개 등급(+None)을 location/description 신호로 분류하고 단위 테스트 통과.
- V10 마이그레이션으로 `jobs.remote_eligibility` / `remote_evidence` 컬럼 + 인덱스 존재.
- ETL 이 매 사이클 두 축(비자/원격)을 저장하고, 확정 막힘(`no_sponsor` + 비원격/제한) 공고를 드롭하며 그 수를 통계로 보고.
- 전체 python 테스트 그린 + ruff 클린.

## 다음 단계 (별도 계획)

- **Phase 2 (백엔드):** `JobEntity`/`JobRepository`/`JobService` 에 viable 게이트(unclear 기본 숨김) + `includeUnclear` 토글 + `track` 필터 + remote 티어 정렬 + `JobSearchTest` 확장.
- **Phase 3 (웹):** 소프트포크 랜딩(이주/원격/둘다) + `RemoteBadge`(worldwide/apac_ok만) + "미확인 공고 포함" 토글 + 트랙 전환.
