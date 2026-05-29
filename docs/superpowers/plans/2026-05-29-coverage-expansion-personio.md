# 공고 확대 — Personio 커넥터 + EU/스폰서 회사 추가 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Personio 공개 XML 피드를 수집하는 ATS 커넥터를 추가하고, 라이브 검증된 Personio + EU/스폰서 회사를 `companies.json`에 등록해 활성 공고와 스폰서 풀을 늘린다.

**Architecture:** 기존 ATS 커넥터 패턴(`smartrecruiters.py`)을 그대로 따른다. 신규 `personio.py`는 stdlib `xml.etree.ElementTree`로 `<workzag-jobs>/<position>`을 파싱하는 순수 함수 + `async fetch()`로 구성. `app/etl/jobs.py`의 `ATS_FETCHERS`에 등록하면 `registry.list_all()` 기반 선택 루프가 자동 포함한다. 회사 추가는 라이브 검증 통과분만. 변경은 `ai/`에 한정(MCP 미러 없음).

**Tech Stack:** Python 3 / httpx(AsyncClient) / xml.etree.ElementTree(stdlib) / pytest / `JobPosting` dataclass(`ai/dev_jobs_core/models.py`).

설계 근거 전문: `docs/superpowers/specs/2026-05-29-coverage-expansion-personio-design.md`.

> 모든 테스트/명령은 `ai/` 디렉터리에서 실행한다(`cd ai`). 테스트는 네트워크를 타지 않는다 — 라이브 검증(Task 4)만 별도 운영 절차.

---

## File Structure

- Create: `ai/dev_jobs_core/sources/personio.py` — Personio XML 피드 수집 커넥터(순수 파서 + async fetch). 단일 책임: 토큰 → `list[JobPosting]`.
- Create: `ai/tests/test_personio.py` — 커넥터 순수 함수 단위 테스트(픽스처 XML, 네트워크 없음).
- Create: `ai/tests/test_etl_fetchers.py` — `ATS_FETCHERS` 등록 스모크 테스트.
- Create: `ai/tests/test_companies_registry.py` — `companies.json` 구조 유효성 가드 테스트.
- Modify: `ai/app/etl/jobs.py:16` (import) 및 `:36-41` (`ATS_FETCHERS` dict) — personio 등록.
- Modify: `ai/dev_jobs_core/data/companies.json` — 검증 통과 회사 추가 + `_meta` 갱신.
- Temp(커밋 안 함): `ai/scripts/verify_personio_tokens.py` — Task 4 일회성 검증 스크립트.

---

### Task 1: Personio 커넥터

**Files:**
- Create: `ai/dev_jobs_core/sources/personio.py`
- Test: `ai/tests/test_personio.py`

- [ ] **Step 1: 실패하는 테스트 작성**

`ai/tests/test_personio.py`:

```python
from dev_jobs_core.sources import personio

XML_WITH_BODY = """<?xml version="1.0" encoding="UTF-8"?>
<workzag-jobs>
  <position>
    <id>1834171</id>
    <subcompany>Personio SE &amp; Co. KG</subcompany>
    <office>Munich</office>
    <additionalOffices><office>Berlin</office></additionalOffices>
    <department>Product and Tech</department>
    <recruitingCategory>Engineering</recruitingCategory>
    <name>Staff Software Engineer, Data Platform</name>
    <jobDescriptions>
      <jobDescription><name>Tasks</name><value><![CDATA[Design and build systems.]]></value></jobDescription>
      <jobDescription><name>Requirements</name><value><![CDATA[7+ years.]]></value></jobDescription>
    </jobDescriptions>
    <employmentType>permanent</employmentType>
    <createdAt>2024-11-13T14:10:41+00:00</createdAt>
  </position>
  <position>
    <name>no id — skipped</name>
  </position>
</workzag-jobs>"""

XML_EMPTY_DESC = """<?xml version="1.0" encoding="UTF-8"?>
<workzag-jobs>
  <position>
    <id>42</id>
    <office>Amsterdam</office>
    <name>Backend Engineer</name>
    <jobDescriptions></jobDescriptions>
    <employmentType>permanent</employmentType>
    <createdAt>2026-01-02T00:00:00+00:00</createdAt>
  </position>
</workzag-jobs>"""


def test_parse_positions_returns_all_positions():
    assert len(personio._parse_positions(XML_WITH_BODY)) == 2
    assert personio._parse_positions("") == []
    assert personio._parse_positions("not xml <<<") == []


def test_to_posting_maps_fields():
    pos = personio._parse_positions(XML_WITH_BODY)[0]
    p = personio._to_posting("acme", pos)
    assert p is not None
    assert p.job_id == "personio:acme:1834171"
    assert p.source == "personio"
    assert p.title == "Staff Software Engineer, Data Platform"
    assert p.company == "Personio SE & Co. KG"
    assert p.location == "Munich, Berlin"
    assert p.employment_type == "permanent"
    assert "Design and build systems." in p.description
    assert "7+ years." in p.description
    assert p.apply_url == "https://acme.jobs.personio.com/job/1834171"
    assert p.posted_at == "2024-11-13T14:10:41+00:00"


def test_to_posting_skips_without_id():
    pos = personio._parse_positions(XML_WITH_BODY)[1]
    assert personio._to_posting("acme", pos) is None


def test_to_posting_company_falls_back_to_token():
    pos = personio._parse_positions(XML_EMPTY_DESC)[0]
    p = personio._to_posting("mollie", pos)
    assert p.company == "mollie"
    assert p.location == "Amsterdam"
    assert p.description == ""
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd ai && python -m pytest tests/test_personio.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'dev_jobs_core.sources.personio'`

- [ ] **Step 3: 커넥터 구현**

`ai/dev_jobs_core/sources/personio.py`:

```python
"""Personio 공개 채용 피드(무료, 키 불필요). 회사별 공고 수집.

피드: https://{token}.jobs.personio.com/xml
루트 <workzag-jobs> / 자식 <position> 반복. 본문은 <jobDescriptions> 안
<jobDescription><value> 블록에 인라인으로 들어 있어 상세 콜이 필요 없다.

주의: 존재하지 않는 서브도메인은 personio.com 으로 307 리다이렉트되므로,
회사 토큰은 사전에 개별 검증해야 한다(플랜 Task 4 참고).
"""
from __future__ import annotations

import xml.etree.ElementTree as ET

import httpx

from ..models import JobPosting


def _parse_positions(xml_text: str) -> list[dict]:
    """<position> 요소들을 평탄한 dict 리스트로. 파싱 실패/빈 입력 → []."""
    if not xml_text or not xml_text.strip():
        return []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return []
    positions: list[dict] = []
    for pos in root.findall("position"):
        positions.append(pos)  # ElementTree 요소를 그대로 넘겨 헬퍼에서 추출
    return positions


def _text(pos, tag: str) -> str:
    el = pos.find(tag)
    return (el.text or "").strip() if el is not None else ""


def _location(pos) -> str:
    offices = []
    main = _text(pos, "office")
    if main:
        offices.append(main)
    extra = pos.find("additionalOffices")
    if extra is not None:
        for o in extra.findall("office"):
            t = (o.text or "").strip()
            if t:
                offices.append(t)
    return ", ".join(offices)


def _description(pos) -> str:
    descs = pos.find("jobDescriptions")
    if descs is None:
        return ""
    parts = []
    for jd in descs.findall("jobDescription"):
        v = jd.find("value")
        if v is not None and v.text:
            parts.append(v.text.strip())
    return "\n".join(parts)


def _to_posting(token: str, pos) -> JobPosting | None:
    jid = _text(pos, "id")
    if not jid:
        return None
    return JobPosting(
        job_id=f"personio:{token}:{jid}",
        source="personio",
        title=_text(pos, "name"),
        company=_text(pos, "subcompany") or token,
        location=_location(pos),
        is_remote=False,
        employment_type=_text(pos, "employmentType"),
        description=_description(pos),
        apply_url=f"https://{token}.jobs.personio.com/job/{jid}",
        posted_at=_text(pos, "createdAt"),
    )


async def fetch(token: str, limit: int = 20) -> list[JobPosting]:
    async with httpx.AsyncClient(
        timeout=30, headers={"User-Agent": "dev-jobs/0.1"}, follow_redirects=False
    ) as client:
        resp = await client.get(f"https://{token}.jobs.personio.com/xml")
        resp.raise_for_status()
        positions = _parse_positions(resp.text)[:limit]
    postings = [_to_posting(token, p) for p in positions]
    return [p for p in postings if p is not None]
```

> `_parse_positions`는 ElementTree 요소를 그대로 리스트에 담아 헬퍼(`_text`/`_location`/`_description`)가 추출한다. 테스트는 `_parse_positions(...)[i]`를 `_to_posting`에 그대로 넘기므로 이 계약이 맞아야 한다. `follow_redirects=False`로 두면 잘못된 토큰의 307이 `raise_for_status()`에서 에러가 되어 상위 ETL 루프가 회사 단위로 격리한다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd ai && python -m pytest tests/test_personio.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: 커밋**

```bash
git add ai/dev_jobs_core/sources/personio.py ai/tests/test_personio.py
git commit -m "feat(etl): Personio 공개 XML 피드 커넥터 추가"
```

---

### Task 2: ETL에 personio 등록

**Files:**
- Modify: `ai/app/etl/jobs.py:16` (import), `:36-41` (`ATS_FETCHERS`)
- Test: `ai/tests/test_etl_fetchers.py`

- [ ] **Step 1: 실패하는 테스트 작성**

`ai/tests/test_etl_fetchers.py`:

```python
from app.etl.jobs import ATS_FETCHERS
from dev_jobs_core.sources import personio


def test_personio_registered_in_ats_fetchers():
    assert "personio" in ATS_FETCHERS
    assert ATS_FETCHERS["personio"] is personio.fetch


def test_all_ats_fetchers_are_callable():
    for name, fn in ATS_FETCHERS.items():
        assert callable(fn), f"{name} fetcher is not callable"
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd ai && python -m pytest tests/test_etl_fetchers.py -v`
Expected: FAIL — `assert "personio" in ATS_FETCHERS` 실패 (KeyError/AssertionError)

- [ ] **Step 3: jobs.py 수정**

`ai/app/etl/jobs.py:16` import 라인을 교체:

```python
from dev_jobs_core.sources import adzuna, arbeitnow, ashby, greenhouse, lever, personio, remoteok, smartrecruiters, weworkremotely
```

`ai/app/etl/jobs.py:36-41` `ATS_FETCHERS`에 personio 추가:

```python
ATS_FETCHERS = {
    "greenhouse": greenhouse.fetch,
    "lever": lever.fetch,
    "ashby": ashby.fetch,
    "smartrecruiters": smartrecruiters.fetch,
    "personio": personio.fetch,
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd ai && python -m pytest tests/test_etl_fetchers.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: 커밋**

```bash
git add ai/app/etl/jobs.py ai/tests/test_etl_fetchers.py
git commit -m "feat(etl): ATS_FETCHERS에 personio 등록"
```

---

### Task 3: companies.json 유효성 가드 테스트

기존 데이터는 이미 유효하므로 이 테스트는 작성 즉시 통과한다(회귀 가드). Task 5의 회사 추가가 구조를 깨지 않도록 보호한다.

**Files:**
- Test: `ai/tests/test_companies_registry.py`

- [ ] **Step 1: 테스트 작성**

`ai/tests/test_companies_registry.py`:

```python
import json
from pathlib import Path

from app.etl.jobs import ATS_FETCHERS

REGISTRY_PATH = Path(__file__).parent.parent / "dev_jobs_core" / "data" / "companies.json"


def _load():
    with open(REGISTRY_PATH) as f:
        return json.load(f)


def test_companies_json_is_valid_json():
    data = _load()
    assert isinstance(data, dict)
    assert "_meta" in data


def test_every_company_has_known_ats_and_token():
    data = _load()
    known = set(ATS_FETCHERS.keys())
    for name, info in data.items():
        if name.startswith("_"):
            continue
        assert info.get("ats") in known, f"{name}: unknown ats {info.get('ats')!r}"
        assert info.get("token"), f"{name}: empty token"


def test_no_duplicate_tokens_per_ats():
    data = _load()
    seen = set()
    for name, info in data.items():
        if name.startswith("_"):
            continue
        key = (info["ats"], info["token"].lower())
        assert key not in seen, f"duplicate {key} ({name})"
        seen.add(key)
```

- [ ] **Step 2: 테스트 통과 확인(현 데이터 기준)**

Run: `cd ai && python -m pytest tests/test_companies_registry.py -v`
Expected: PASS (3 passed) — 현재 122개사 데이터가 이미 유효.

> 만약 `test_no_duplicate_tokens_per_ats`가 기존 데이터에서 실패하면, 중복이 실재하는 버그이므로 해당 중복 항목을 companies.json에서 제거하고 같은 커밋에 포함한다.

- [ ] **Step 3: 커밋**

```bash
git add ai/tests/test_companies_registry.py
git commit -m "test(etl): companies.json 구조 유효성 가드 테스트 추가"
```

---

### Task 4: 후보 토큰 라이브 검증 (운영 단계, 커밋 없음)

회사 추가 전 토큰을 개별 검증한다. Personio는 잘못된 서브도메인을 307로 리다이렉트하고 빠른 반복 조회 시 429를 반환하므로 **순차 + 간격** 조회한다. 결과(포함/제외 목록)는 채팅과 PR 설명에 요약한다.

**Files:**
- Temp: `ai/scripts/verify_personio_tokens.py` (검증 후 삭제, 커밋 안 함)

- [ ] **Step 1: 검증 스크립트 작성**

`ai/scripts/verify_personio_tokens.py`:

```python
"""Personio 후보 토큰 라이브 검증(일회성, 커밋 안 함).

포함 기준(셋 다 충족): HTTP 200 + position >= 1 + dev 필터 통과 position >= 1.
순차 + sleep 으로 rate limit(429) 회피.
"""
import asyncio
import sys

import httpx

sys.path.insert(0, ".")
from dev_jobs_core.sources import personio
from dev_jobs_core.filter import is_dev_role

CANDIDATES = [
    "trivago", "aboutyou", "getyourguide", "hellofresh", "babbel",
    "celonis", "picnic", "personio", "flixbus", "sennder", "freenow",
]


async def main():
    include, exclude = [], []
    async with httpx.AsyncClient(
        timeout=20, headers={"User-Agent": "dev-jobs/0.1"}, follow_redirects=False
    ) as client:
        for tok in CANDIDATES:
            try:
                r = await client.get(f"https://{tok}.jobs.personio.com/xml")
                if r.status_code != 200:
                    exclude.append((tok, f"http {r.status_code}"))
                    await asyncio.sleep(3)
                    continue
                positions = personio._parse_positions(r.text)
                postings = [p for p in (personio._to_posting(tok, x) for x in positions) if p]
                dev = [p for p in postings if is_dev_role(p.title, p.tags, p.description)]
                if postings and dev:
                    include.append((tok, len(postings), len(dev)))
                else:
                    exclude.append((tok, f"positions={len(postings)} dev={len(dev)}"))
            except Exception as e:
                exclude.append((tok, f"{type(e).__name__}: {e}"))
            await asyncio.sleep(3)
    print("INCLUDE (token, total, dev):")
    for x in include:
        print(" ", x)
    print("EXCLUDE:")
    for x in exclude:
        print(" ", x)


asyncio.run(main())
```

> 시그니처는 확인됨: `is_dev_role(title: str, tags: list[str] | None = None, description: str = "") -> bool`. 위 호출부(`is_dev_role(p.title, p.tags, p.description)`)가 이에 맞춰져 있다.

- [ ] **Step 2: 검증 실행**

Run: `cd ai && python scripts/verify_personio_tokens.py`
Expected: INCLUDE/EXCLUDE 목록 출력. 시간이 걸린다(토큰당 3초 간격). 429가 나면 해당 토큰은 EXCLUDE 처리.

- [ ] **Step 3: greenhouse/ashby EU 후보도 동일 기준 확인**

EU/스폰서 greenhouse·ashby 후보(adyen, mollie, bunq, traderepublic, klaviyo, datadog, snowflake, cloudflare, mistral, deepl, jetbrains 등)는 기존 커넥터로 확인. 일회성 확인:

```bash
cd ai && python -c "
import asyncio
from dev_jobs_core.sources import greenhouse, ashby
from dev_jobs_core.filter import is_dev_role
CANDS = [('greenhouse','adyen'), ('ashby','mollie')]  # 실제 후보로 채우기
async def main():
    for ats, tok in CANDS:
        fn = {'greenhouse': greenhouse.fetch, 'ashby': ashby.fetch}[ats]
        try:
            ps = await fn(tok, limit=50)
            dev = [p for p in ps if is_dev_role(p.title, p.tags, p.description)]
            print(ats, tok, 'total', len(ps), 'dev', len(dev))
        except Exception as e:
            print(ats, tok, 'ERR', type(e).__name__, e)
asyncio.run(main())
"
```

> 각 후보의 정확한 ATS 토큰은 미리 모른다. greenhouse는 `boards.greenhouse.io/{token}`, ashby는 `jobs.ashbyhq.com/{token}`의 슬러그다. 동작하는 슬러그만 INCLUDE.

- [ ] **Step 4: 검증 스크립트 삭제**

```bash
rm ai/scripts/verify_personio_tokens.py
```

> 이 Task는 커밋을 만들지 않는다. 산출물은 Task 5에서 쓸 "검증 통과 회사 목록"이다.

---

### Task 5: 검증 통과 회사 등록 + _meta 갱신

**Files:**
- Modify: `ai/dev_jobs_core/data/companies.json`
- Test: `ai/tests/test_companies_registry.py` (Task 3, 재실행)

- [ ] **Step 1: 검증 통과 회사 추가**

Task 4에서 INCLUDE된 회사만 `companies.json`에 추가한다. 기존 항목과 같은 형식:

```json
"mollie": {"ats": "personio", "token": "mollie", "tags": ["fintech", "payments", "europe"]},
"trivago": {"ats": "personio", "token": "trivago", "tags": ["travel", "europe"]}
```

규칙:
- Personio 회사는 `"ats": "personio"`, `token`은 Task 4에서 동작 확인된 서브도메인.
- greenhouse/ashby EU 회사는 해당 `ats`와 동작 확인된 슬러그.
- 모든 신규 EU 회사 `tags`에 `"europe"` 포함.
- 검증 못 한 토큰은 추가하지 않는다(조용히 제외).

`_meta` 갱신:

```json
"_meta": {
  "description": "회사명 → ATS 매핑. 추가 가능. ats: greenhouse / lever / ashby / smartrecruiters / personio",
  "last_updated": "2026-05-29"
}
```

- [ ] **Step 2: JSON 유효성 + 가드 테스트 재실행**

Run: `cd ai && python -m pytest tests/test_companies_registry.py -v`
Expected: PASS (3 passed) — 신규 항목이 known ats + non-empty token + 중복 없음을 만족.

- [ ] **Step 3: 레지스트리 로드 스모크 확인**

Run:
```bash
cd ai && python -c "
from dev_jobs_core import registry
allc = registry.list_all()
personio = [c for c in allc if c['ats']=='personio']
print('total', len(allc), 'personio', len(personio), 'europe', sum(1 for c in allc if 'europe' in c.get('tags',[])))
"
```
Expected: total이 122 + 추가수, personio 개수 > 0 출력.

- [ ] **Step 4: 커밋**

```bash
git add ai/dev_jobs_core/data/companies.json
git commit -m "feat(etl): 라이브 검증된 Personio + EU 스폰서 회사 등록"
```

---

### Task 6: 전체 테스트 + 최종 확인

- [ ] **Step 1: ai 테스트 전체 실행**

Run: `cd ai && python -m pytest tests/ -v`
Expected: 전부 PASS(신규 test_personio / test_etl_fetchers / test_companies_registry 포함, 기존 테스트 무회귀).

- [ ] **Step 2: 변경 요약 확인**

Run: `git log --oneline origin/main..HEAD`
Expected: Task 1·2·3·5 커밋 4개(Task 4는 커밋 없음).

> 라이브 ETL 1사이클 실행으로 실제 공고 증가를 확인하는 것은 finishing-a-development-branch 이후 검증 단계에서 수행한다(이 플랜 범위는 커넥터·등록·회사 추가까지).

---

## Self-Review

- **Spec coverage:** 스펙 §3.1 커넥터 → Task 1. §3.2 ETL 등록 → Task 2. §5 테스트(personio 단위/ETL 등록 스모크/companies.json 유효성) → Task 1·2·3. §4 라이브 검증 → Task 4. §3.3 회사 추가 + _meta → Task 5. §6 범위 밖(MCP 미러 없음) → 어떤 Task도 `dev-jobs-mcp/`를 건드리지 않음. 누락 없음.
- **Placeholder scan:** TBD/TODO 없음. 후보 회사 목록은 의도적으로 Task 4 검증 게이트를 거친다(플레이스홀더 아님). 모든 코드 스텝에 실제 코드 포함.
- **Type consistency:** `_parse_positions`는 일관되게 ElementTree 요소 리스트를 반환하고 `_text/_location/_description/_to_posting`이 요소를 받는다. 테스트와 구현의 계약 일치. `fetch` 시그니처(`token, limit=20`)는 기존 커넥터·`_fetch_ats_company` 호출부(`fn(token, limit=limit)`)와 일치. `JobPosting` 필드명(job_id/source/title/company/location/is_remote/employment_type/description/apply_url/posted_at) 모델과 일치.
