# 공고 커버리지 확대 (무료 집계 소스) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adzuna(무료 집계 API)와 WeWorkRemotely(무료 RSS)를 ai ETL에 추가하고, 개발 직무 필터 + 크로스소스 중복제거를 넣어 활성 공고 수를 무료로 대폭 늘린다.

**Architecture:** 소스 커넥터는 순수 `_parse_*()`(I/O 없음) + 얇은 `fetch()`(httpx)로 분리해 네트워크 모킹 없이 파싱을 테스트한다. 필터/중복제거는 순수 함수. ETL 오케스트레이션(`run_full_cycle`)에 소스 배선 + 필터 + dedup을 끼운다.

**Tech Stack:** Python 3.13, httpx, pydantic-settings, pytest + pytest-asyncio, stdlib xml.etree(WWR RSS). 임베딩은 기존 로컬 모델(추가 비용 0).

**전제:**
- 모든 경로는 `ai/` 기준. 테스트: `cd /Users/mac/WordDeveloper/WorldDeveloper/ai && uv run pytest tests/<file> -v`.
- 소스 커넥터는 `ai/dev_jobs_core/sources/`, 필터/중복은 `ai/dev_jobs_core/`. (`dev-jobs-mcp/` 의 동명 파일은 별개 — 손대지 않는다.)
- 기존 커넥터 패턴: `async def fetch(query="", limit=...) -> list[JobPosting]`, `from ..models import JobPosting`.
- `JobPosting` 필드: job_id, source, title, company, location, is_remote, employment_type, description, apply_url, posted_at, closes_at, tags, salary_min/max/currency/period, visa_status.
- 스펙: `docs/superpowers/specs/2026-05-25-job-coverage-expansion-design.md`.
- 작업 트리에 미커밋 `.env`(gitignore)·`.claude/`(untracked) 있음 — 절대 `git add` 하지 말 것. 각 커밋은 명시한 파일만 stage.

---

### Task 1: Adzuna 설정 + .env.example

**Files:**
- Modify: `ai/app/config.py`
- Modify: `.env.example` (repo 루트)

- [ ] **Step 1: config.py 에 Adzuna 설정 추가**

`ai/app/config.py` 의 `Settings` 클래스에서 ETL 블록(`job_max_age_days` 줄) 바로 아래에 추가:

```python
    # Adzuna (무료 집계 소스). ADZUNA_APP_ID/KEY 없으면 비활성(다른 소스는 정상).
    adzuna_app_id: str = ""
    adzuna_app_key: str = ""
    adzuna_countries: str = "us,gb,de,nl,ca,fr,ie,au,sg"
    adzuna_per_country: int = 50
    adzuna_max_pages: int = 1

    @property
    def adzuna_countries_list(self) -> list[str]:
        return [c.strip() for c in self.adzuna_countries.split(",") if c.strip()]
```

- [ ] **Step 2: 설정 로드 확인**

Run: `cd /Users/mac/WordDeveloper/WorldDeveloper/ai && uv run python -c "from app.config import settings; print(settings.adzuna_countries_list); print(settings.adzuna_app_id == '')"`
Expected: `['us', 'gb', 'de', 'nl', 'ca', 'fr', 'ie', 'au', 'sg']` 와 `True` 출력.

- [ ] **Step 3: .env.example 에 Adzuna 키 안내 추가**

`.env.example`(루트)의 메일 블록 끝(`MAIL_FROM=...` 다음 줄)에 추가:

```bash

# --- Adzuna (무료 공고 집계, https://developer.adzuna.com 에서 무료 발급) ---
# 없으면 Adzuna 소스만 비활성(나머지 수집은 정상 동작)
ADZUNA_APP_ID=
ADZUNA_APP_KEY=
# 선택: 수집 국가/한도 (기본값 사용 시 생략 가능)
# ADZUNA_COUNTRIES=us,gb,de,nl,ca,fr,ie,au,sg
```

- [ ] **Step 4: 커밋 (명시 파일만)**

```bash
cd /Users/mac/WordDeveloper/WorldDeveloper
git add ai/app/config.py .env.example
git commit -m "feat(jobs): Adzuna 설정 + .env.example 안내"
```

---

### Task 2: 개발 직무 필터 `is_dev_role`

**Files:**
- Create: `ai/dev_jobs_core/filter.py`
- Test: `ai/tests/test_filter.py`

- [ ] **Step 1: 실패 테스트 작성**

`ai/tests/test_filter.py`:

```python
from dev_jobs_core.filter import is_dev_role


def test_keeps_engineering_titles():
    assert is_dev_role("Senior Backend Engineer")
    assert is_dev_role("Software Developer")
    assert is_dev_role("DevOps / SRE")
    assert is_dev_role("Machine Learning Engineer")


def test_drops_non_dev_titles():
    assert not is_dev_role("Account Executive (Sales)")
    assert not is_dev_role("Technical Recruiter")
    assert not is_dev_role("Product Marketing Manager")
    assert not is_dev_role("Product Manager")
    assert not is_dev_role("Senior Product Designer")


def test_ambiguous_kept_recall_first():
    # 제외 키워드 없으면 keep (재현율 우선)
    assert is_dev_role("Data Analyst")
    assert is_dev_role("Solutions Architect")
```

- [ ] **Step 2: 실패 확인**

Run: `cd /Users/mac/WordDeveloper/WorldDeveloper/ai && uv run pytest tests/test_filter.py -v`
Expected: FAIL (`ModuleNotFoundError: dev_jobs_core.filter`)

- [ ] **Step 3: 구현**

`ai/dev_jobs_core/filter.py`:

```python
"""개발 직무 필터. 집계/보드 소스의 비개발 공고를 제거한다.

스펙 §B-1: 제외 키워드가 title 에 있으면 drop, 아니면 keep(재현율 우선).
"""
from __future__ import annotations

# title 에 포함되면 비개발로 보고 drop
_DENY = (
    "sales", "account executive", "marketing", "recruiter", "recruiting",
    "talent acquisition", "customer success", "customer support",
    "account manager", "finance", "accountant", "human resources",
    "designer", "product manager", "product owner", "content writer",
    "copywriter", "social media", "business development", "office manager",
)


def is_dev_role(title: str, tags: list[str] | None = None, description: str = "") -> bool:
    t = (title or "").lower()
    for d in _DENY:
        if d in t:
            return False
    # 제외 키워드 없음 → 개발 공고로 간주(재현율 우선). tags/description 은
    # 향후 정밀 필터 확장 여지로 시그니처에만 둔다.
    return True
```

- [ ] **Step 4: 통과 확인**

Run: `cd /Users/mac/WordDeveloper/WorldDeveloper/ai && uv run pytest tests/test_filter.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
cd /Users/mac/WordDeveloper/WorldDeveloper
git add ai/dev_jobs_core/filter.py ai/tests/test_filter.py
git commit -m "feat(jobs): 개발 직무 필터 is_dev_role"
```

---

### Task 3: 크로스소스 중복제거 `dedup`

**Files:**
- Create: `ai/dev_jobs_core/dedup.py`
- Test: `ai/tests/test_dedup.py`

- [ ] **Step 1: 실패 테스트 작성**

`ai/tests/test_dedup.py`:

```python
from dev_jobs_core.dedup import dedup
from dev_jobs_core.models import JobPosting


def _p(job_id, source, company, title, location=""):
    return JobPosting(job_id=job_id, source=source, title=title, company=company, location=location)


def test_exact_job_id_dedup():
    a = _p("adzuna:us:1", "adzuna", "Acme", "Backend Engineer")
    b = _p("adzuna:us:1", "adzuna", "Acme", "Backend Engineer")
    assert len(dedup([a, b])) == 1


def test_cross_source_same_job_prefers_higher_priority():
    # 같은 회사+직함, 다른 소스 → ATS(greenhouse) 채택
    adz = _p("adzuna:us:9", "adzuna", "Acme Inc.", "Backend Engineer", "Berlin, Germany")
    gh = _p("greenhouse:acme:5", "greenhouse", "Acme", "Backend Engineer", "Berlin")
    out = dedup([adz, gh])
    assert len(out) == 1
    assert out[0].source == "greenhouse"


def test_different_jobs_kept():
    a = _p("adzuna:us:1", "adzuna", "Acme", "Backend Engineer")
    b = _p("adzuna:us:2", "adzuna", "Acme", "Frontend Engineer")
    assert len(dedup([a, b])) == 2
```

- [ ] **Step 2: 실패 확인**

Run: `cd /Users/mac/WordDeveloper/WorldDeveloper/ai && uv run pytest tests/test_dedup.py -v`
Expected: FAIL (`ModuleNotFoundError: dev_jobs_core.dedup`)

- [ ] **Step 3: 구현**

`ai/dev_jobs_core/dedup.py`:

```python
"""크로스소스 중복제거: job_id 완전일치 + 정규화 키 + 소스 우선순위."""
from __future__ import annotations

import re

from .models import JobPosting

# 높을수록 우선 채택 (신뢰도: ATS > 네이티브 보드 > 집계)
_SOURCE_PRIORITY = {
    "greenhouse": 3, "lever": 3, "ashby": 3,
    "remoteok": 2, "arbeitnow": 2, "wwr": 2,
    "adzuna": 1,
}

_SUFFIX = re.compile(r"\b(inc|llc|ltd|gmbh|b\.?v|ab|oy|sa|co|corp|company)\b\.?", re.IGNORECASE)
_NONWORD = re.compile(r"[^a-z0-9가-힣]+")


def _priority(source: str) -> int:
    return _SOURCE_PRIORITY.get(source, 0)


def _norm(s: str) -> str:
    s = (s or "").lower()
    s = _SUFFIX.sub(" ", s)
    s = _NONWORD.sub(" ", s)
    return " ".join(s.split())


def _key(p: JobPosting) -> str:
    loc = _norm(p.location).split()
    loc_key = loc[0] if loc else ""
    return f"{_norm(p.company)}|{_norm(p.title)}|{loc_key}"


def dedup(postings: list[JobPosting]) -> list[JobPosting]:
    # 1차: job_id 완전일치
    by_id: dict[str, JobPosting] = {}
    for p in postings:
        by_id[p.job_id] = p
    # 2차: 정규화 키 + 소스 우선순위
    best: dict[str, JobPosting] = {}
    for p in by_id.values():
        k = _key(p)
        cur = best.get(k)
        if cur is None or _priority(p.source) > _priority(cur.source):
            best[k] = p
    return list(best.values())
```

- [ ] **Step 4: 통과 확인**

Run: `cd /Users/mac/WordDeveloper/WorldDeveloper/ai && uv run pytest tests/test_dedup.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
cd /Users/mac/WordDeveloper/WorldDeveloper
git add ai/dev_jobs_core/dedup.py ai/tests/test_dedup.py
git commit -m "feat(jobs): 크로스소스 dedup (정규화 키 + 소스 우선순위)"
```

---

### Task 4: Adzuna 커넥터

**Files:**
- Create: `ai/dev_jobs_core/sources/adzuna.py`
- Test: `ai/tests/test_adzuna.py`

- [ ] **Step 1: 실패 테스트 작성**

`ai/tests/test_adzuna.py`:

```python
from dev_jobs_core.sources import adzuna


SAMPLE = {
    "results": [
        {
            "id": "12345",
            "title": "Backend Engineer",
            "company": {"display_name": "Acme GmbH"},
            "location": {"display_name": "Berlin, Germany"},
            "description": "We need a backend engineer.",
            "redirect_url": "https://www.adzuna.de/land/ad/12345",
            "created": "2026-05-20T10:00:00Z",
            "salary_min": 60000.0,
            "salary_max": 90000.0,
        },
        {"title": "no id — skipped"},
    ]
}


def test_parse_results_maps_fields():
    out = adzuna._parse_results("de", SAMPLE)
    assert len(out) == 1
    p = out[0]
    assert p.job_id == "adzuna:de:12345"
    assert p.source == "adzuna"
    assert p.title == "Backend Engineer"
    assert p.company == "Acme GmbH"
    assert p.location == "Berlin, Germany"
    assert p.apply_url == "https://www.adzuna.de/land/ad/12345"
    assert p.salary_min == 60000 and p.salary_max == 90000


def test_disabled_without_keys(monkeypatch):
    monkeypatch.delenv("ADZUNA_APP_ID", raising=False)
    monkeypatch.delenv("ADZUNA_APP_KEY", raising=False)
    assert adzuna.is_enabled() is False


def test_enabled_with_keys(monkeypatch):
    monkeypatch.setenv("ADZUNA_APP_ID", "x")
    monkeypatch.setenv("ADZUNA_APP_KEY", "y")
    assert adzuna.is_enabled() is True
```

- [ ] **Step 2: 실패 확인**

Run: `cd /Users/mac/WordDeveloper/WorldDeveloper/ai && uv run pytest tests/test_adzuna.py -v`
Expected: FAIL (`ImportError`/`ModuleNotFoundError`)

- [ ] **Step 3: 구현**

`ai/dev_jobs_core/sources/adzuna.py`:

```python
"""Adzuna API (무료, app_id/app_key 등록). 국가별 IT/개발 공고 수집.

ADZUNA_APP_ID / ADZUNA_APP_KEY 가 설정된 경우만 활성화(없으면 빈 리스트).
"""
from __future__ import annotations

import os

import httpx

from ..models import JobPosting

BASE = "https://api.adzuna.com/v1/api/jobs"


def is_enabled() -> bool:
    return bool(os.getenv("ADZUNA_APP_ID") and os.getenv("ADZUNA_APP_KEY"))


def _to_int(v) -> int | None:
    try:
        return int(float(v)) if v is not None else None
    except (TypeError, ValueError):
        return None


def _parse_results(country: str, payload: dict) -> list[JobPosting]:
    out: list[JobPosting] = []
    for item in payload.get("results", []) or []:
        jid = item.get("id")
        if not jid:
            continue
        title = item.get("title", "") or ""
        location = (item.get("location") or {}).get("display_name", "") or ""
        out.append(JobPosting(
            job_id=f"adzuna:{country}:{jid}",
            source="adzuna",
            title=title,
            company=(item.get("company") or {}).get("display_name", "") or "",
            location=location,
            is_remote="remote" in f"{title} {location}".lower(),
            description=item.get("description", "") or "",
            apply_url=item.get("redirect_url", "") or "",
            posted_at=str(item.get("created", "") or ""),
            salary_min=_to_int(item.get("salary_min")),
            salary_max=_to_int(item.get("salary_max")),
        ))
    return out


async def fetch(countries: list[str], query: str = "developer", per_country: int = 50,
                max_pages: int = 1, max_days_old: int = 45) -> list[JobPosting]:
    if not is_enabled():
        return []
    app_id = os.getenv("ADZUNA_APP_ID", "")
    app_key = os.getenv("ADZUNA_APP_KEY", "")
    postings: list[JobPosting] = []
    async with httpx.AsyncClient(timeout=30, headers={"User-Agent": "dev-jobs/0.1"}) as client:
        for country in countries:
            for page in range(1, max_pages + 1):
                params = {
                    "app_id": app_id,
                    "app_key": app_key,
                    "what": query,
                    "category": "it-jobs",
                    "results_per_page": min(per_country, 50),
                    "max_days_old": max_days_old,
                    "content-type": "application/json",
                }
                try:
                    resp = await client.get(f"{BASE}/{country}/search/{page}", params=params)
                    resp.raise_for_status()
                    postings.extend(_parse_results(country, resp.json()))
                except Exception:
                    break  # 이 국가 실패 → 다음 국가
    return postings
```

- [ ] **Step 4: 통과 확인**

Run: `cd /Users/mac/WordDeveloper/WorldDeveloper/ai && uv run pytest tests/test_adzuna.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
cd /Users/mac/WordDeveloper/WorldDeveloper
git add ai/dev_jobs_core/sources/adzuna.py ai/tests/test_adzuna.py
git commit -m "feat(jobs): Adzuna 소스 커넥터 (국가별 IT 공고)"
```

---

### Task 5: WeWorkRemotely 커넥터

**Files:**
- Create: `ai/dev_jobs_core/sources/weworkremotely.py`
- Test: `ai/tests/test_weworkremotely.py`

- [ ] **Step 1: 실패 테스트 작성**

`ai/tests/test_weworkremotely.py`:

```python
from dev_jobs_core.sources import weworkremotely as wwr

SAMPLE_RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <item>
    <title>Acme Corp: Senior Backend Engineer</title>
    <link>https://weworkremotely.com/remote-jobs/acme-senior-backend</link>
    <guid>https://weworkremotely.com/remote-jobs/acme-senior-backend</guid>
    <description>Great remote role.</description>
    <pubDate>Tue, 20 May 2026 10:00:00 +0000</pubDate>
  </item>
  <item>
    <title>NoCompanyTitle Only</title>
    <link>https://weworkremotely.com/remote-jobs/x</link>
    <guid>wwr-x</guid>
  </item>
</channel></rss>"""


def test_parse_rss_maps_fields():
    out = wwr._parse_rss(SAMPLE_RSS)
    assert len(out) == 2
    p = out[0]
    assert p.job_id == "wwr:https://weworkremotely.com/remote-jobs/acme-senior-backend"
    assert p.source == "wwr"
    assert p.company == "Acme Corp"
    assert p.title == "Senior Backend Engineer"
    assert p.is_remote is True
    assert p.location == "Remote"
    assert p.apply_url == "https://weworkremotely.com/remote-jobs/acme-senior-backend"


def test_parse_rss_title_without_company():
    out = wwr._parse_rss(SAMPLE_RSS)
    assert out[1].company == ""
    assert out[1].title == "NoCompanyTitle Only"
```

- [ ] **Step 2: 실패 확인**

Run: `cd /Users/mac/WordDeveloper/WorldDeveloper/ai && uv run pytest tests/test_weworkremotely.py -v`
Expected: FAIL (`ModuleNotFoundError`)

- [ ] **Step 3: 구현**

`ai/dev_jobs_core/sources/weworkremotely.py`:

```python
"""WeWorkRemotely RSS (무료, 키 불필요) — 원격 프로그래밍 공고."""
from __future__ import annotations

import xml.etree.ElementTree as ET

import httpx

from ..models import JobPosting

RSS_URL = "https://weworkremotely.com/categories/remote-programming-jobs.rss"


def _parse_rss(xml_text: str) -> list[JobPosting]:
    out: list[JobPosting] = []
    root = ET.fromstring(xml_text)
    for item in root.iter("item"):
        link = (item.findtext("link") or "").strip()
        if not link:
            continue
        raw_title = (item.findtext("title") or "").strip()  # 보통 "Company: Title"
        if ":" in raw_title:
            company, _, title = raw_title.partition(":")
            company, title = company.strip(), title.strip()
        else:
            company, title = "", raw_title
        guid = (item.findtext("guid") or link).strip()
        out.append(JobPosting(
            job_id=f"wwr:{guid}",
            source="wwr",
            title=title,
            company=company,
            location="Remote",
            is_remote=True,
            description=(item.findtext("description") or "").strip(),
            apply_url=link,
            posted_at=(item.findtext("pubDate") or "").strip(),
        ))
    return out


async def fetch(query: str = "", limit: int = 100) -> list[JobPosting]:
    async with httpx.AsyncClient(timeout=30, headers={"User-Agent": "dev-jobs/0.1"}) as client:
        resp = await client.get(RSS_URL)
        resp.raise_for_status()
        postings = _parse_rss(resp.text)
    return postings[:limit]
```

- [ ] **Step 4: 통과 확인**

Run: `cd /Users/mac/WordDeveloper/WorldDeveloper/ai && uv run pytest tests/test_weworkremotely.py -v`
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
cd /Users/mac/WordDeveloper/WorldDeveloper
git add ai/dev_jobs_core/sources/weworkremotely.py ai/tests/test_weworkremotely.py
git commit -m "feat(jobs): WeWorkRemotely RSS 소스 커넥터"
```

---

### Task 6: ETL 배선 (소스 추가 + 필터 + dedup)

**Files:**
- Modify: `ai/app/etl/jobs.py`

- [ ] **Step 1: import 추가**

`ai/app/etl/jobs.py` 상단 import 수정:
- 소스 import 줄을 다음으로 교체:
```python
from dev_jobs_core.sources import adzuna, arbeitnow, ashby, greenhouse, lever, remoteok, weworkremotely
```
- 그 아래에 추가:
```python
from dev_jobs_core.dedup import dedup
from dev_jobs_core.filter import is_dev_role
```

- [ ] **Step 2: boards 에 WWR 추가**

`run_full_cycle` 의 `boards = {...}` 줄을 교체:
```python
    boards = {"remoteok": remoteok.fetch, "arbeitnow": arbeitnow.fetch, "wwr": weworkremotely.fetch}
```

- [ ] **Step 3: ATS 블록 다음(주석 `# 2. dedup` 직전)에 Adzuna 단계 추가**

```python
    # 1c. Adzuna (다국가, 키 있을 때만, 실패 격리)
    if adzuna.is_enabled():
        try:
            adz = await adzuna.fetch(
                countries=settings.adzuna_countries_list,
                per_country=settings.adzuna_per_country,
                max_pages=settings.adzuna_max_pages,
            )
            postings.extend(adz)
            fetch_stats["adzuna"] = len(adz)
        except Exception as e:  # noqa: BLE001
            fetch_stats["adzuna"] = f"error: {type(e).__name__}"
            log.warning("adzuna 실패: %s", e)
    else:
        fetch_stats["adzuna"] = "disabled (no key)"

    # 1d. 개발 직무 필터
    before_filter = len(postings)
    postings = [p for p in postings if is_dev_role(p.title, p.tags, p.description)]
    fetch_stats["filtered_out"] = before_filter - len(postings)
```

- [ ] **Step 4: 기존 exact dedup 을 크로스소스 dedup 으로 교체**

기존 줄:
```python
    # 2. dedup (job_id)
    unique = {p.job_id: p for p in postings}
```
을 다음으로 교체:
```python
    # 2. dedup (job_id 완전일치 + 크로스소스 정규화 키 + 소스 우선순위)
    unique_list = dedup(postings)
    fetch_stats["deduped_from"] = len(postings)
    fetch_stats["deduped_to"] = len(unique_list)
```
그리고 그 아래 `for p in unique.values():` 를 `for p in unique_list:` 로,
`"unique": len(unique),` 를 `"unique": len(unique_list),` 로 교체.

- [ ] **Step 5: import + 기존 테스트 회귀 확인**

Run: `cd /Users/mac/WordDeveloper/WorldDeveloper/ai && uv run python -c "import app.etl.jobs; print('etl import ok')" && uv run pytest tests/ -q`
Expected: `etl import ok` 출력 + 전체 테스트 PASS(기존 + 신규 filter/dedup/adzuna/wwr). (run_full_cycle 자체는 I/O 라 단위테스트 대신 Task 7 라이브 실행으로 검증.)

- [ ] **Step 6: 커밋**

```bash
cd /Users/mac/WordDeveloper/WorldDeveloper
git add ai/app/etl/jobs.py
git commit -m "feat(jobs): ETL 에 Adzuna/WWR + 개발필터 + 크로스소스 dedup 배선"
```

---

### Task 7: 라이브 롤아웃 + 측정 (코드 변경 없음)

**Files:** 없음

- [ ] **Step 1: Adzuna 키 발급 + .env 입력**

`https://developer.adzuna.com` 에서 무료 가입 → app_id/app_key 발급. 루트 `.env` 에 입력:
```
ADZUNA_APP_ID=<발급값>
ADZUNA_APP_KEY=<발급값>
```
(키 없이도 나머지 소스로 ETL은 돈다 — Adzuna만 skip.)

- [ ] **Step 2: 인프라 + ai 기동**

```bash
cd /Users/mac/WordDeveloper/WorldDeveloper
docker compose up -d postgres
# ai 서비스 기동(별도 터미널): cd ai && uv run uvicorn app.main:app --port 8001
```

- [ ] **Step 3: ETL 1회 실행 + 통계 확인**

ETL 트리거 라우트(`ai/app/routes/etl.py`)로 1회 실행하거나 직접 호출:
```bash
cd /Users/mac/WordDeveloper/WorldDeveloper/ai && set -a && . ../.env && set +a && uv run python -c "
import asyncio, json
from app.etl.jobs import run_full_cycle
print(json.dumps(asyncio.run(run_full_cycle()), ensure_ascii=False, indent=2))
"
```
Expected: `fetched` 에 `adzuna`(>0), `wwr`(>0), `filtered_out`, `deduped_from/to` 통계가 보이고 `upserted` 가 기존보다 크게 증가.

- [ ] **Step 4: DB 활성 공고 수 측정**

```bash
docker exec dev-jobs-postgres psql -U devjobs -d devjobs -c "SELECT source, count(*) FROM jobs WHERE is_active GROUP BY source ORDER BY 2 DESC; SELECT count(*) AS active_total FROM jobs WHERE is_active;"
```
Expected: `adzuna`/`wwr` 소스 행 등장, active_total 이 491 대비 크게 증가(목표 수천). 소스별 분포·중복 병합율을 보고 `ADZUNA_COUNTRIES`/`adzuna_per_country`/`adzuna_max_pages` 튜닝.

- [ ] **Step 5: 결과 기록**

신규 active 수, 소스별 분포, 필터 제거율, dedup 병합율을 PR 설명에 기록. Adzuna ToS(rate limit·출처표기) 준수 여부 확인.

---

## Self-Review (작성자 점검)

**Spec coverage:**
- Adzuna 커넥터(스펙 §A-1) → Task 4 ✓
- WWR 커넥터(§A-2) → Task 5 ✓
- 개발 직무 필터(§B-1) → Task 2 ✓ (재현율 우선 = deny-then-keep, 스펙 ③과 동일 동작)
- 크로스소스 dedup + 우선순위(§B-2) → Task 3 ✓
- ETL 배선 + 통계(§C) → Task 6 ✓
- 설정/.env(§C) → Task 1 ✓
- 테스트(§D) → 각 Task 의 pytest ✓ / 라이브 롤아웃 → Task 7 ✓
- ToS/한도(§4) → Task 7 Step 5 ✓

**Placeholder scan:** 없음. 코드 단계는 전체 본문 포함. (`<발급값>` 은 사용자 입력 자리로 의도된 것.)

**Type consistency:** 커넥터 `fetch` 시그니처 — `adzuna.fetch(countries, per_country, max_pages)`(Task 4)와 ETL 호출(Task 6 Step 3) 일치. `weworkremotely.fetch(query, limit)`(Task 5)는 boards dict 호출(`fn("", limit=...)`)과 호환. `is_dev_role(title, tags, description)`(Task 2)·`dedup(list)→list`(Task 3) 시그니처가 ETL(Task 6) 사용과 일치. `settings.adzuna_countries_list`(Task 1)를 Task 6 에서 사용 — 일치.

**주의:** run_full_cycle 의 변수명은 기존 코드 기준(`postings`, `fetch_stats`, `unique`→`unique_list`, `result["unique"]`). 구현자는 Task 6 에서 기존 `unique`/`unique.values()`/`len(unique)` 참조를 모두 `unique_list` 로 바꿔야 한다(누락 시 NameError 로 즉시 드러남).
