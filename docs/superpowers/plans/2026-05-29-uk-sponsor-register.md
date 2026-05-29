# UK 스폰서 레지스터 대조 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Home Office UK 스폰서 라이선스 명부에 등재된 회사의 UK 소재 unclear 공고를 `sponsors`로 사실 기반 전환한다.

**Architecture:** 명부 CSV는 오프라인 검증 스크립트에서만 사용해 `companies.json`에 `uk_sponsor: true` 플래그를 큐레이션한다. 런타임 reclassify는 그 플래그(레지스트리에서 로드)와 `is_uk_location` 휴리스틱만으로, 매 ETL 사이클에 unclear 공고를 sponsors로 전환한다(LLM 단계 앞). 매칭 로직은 순수 함수로 분리해 DB 없이 테스트한다.

**Tech Stack:** Python 3 / psycopg / pytest(+pytest-asyncio) / 표준 라이브러리(csv, re, urllib/httpx) / 기존 `visa_reclassify` 파이프라인.

설계 전문: `docs/superpowers/specs/2026-05-29-uk-sponsor-register-design.md`.

> 모든 테스트/명령은 `ai/`에서 `uv run --extra dev python -m pytest ...`로 실행한다(워크트리 루트가 아니라 `cd ai`). 테스트는 네트워크·DB를 타지 않는다.

---

## File Structure

- Create: `ai/dev_jobs_core/analyzers/uk_location.py` — `is_uk_location()` 순수 휴리스틱. 단일 책임: 위치 문자열 → UK 여부.
- Create: `ai/tests/test_uk_location.py`
- Modify: `ai/dev_jobs_core/registry.py` — `uk_sponsor_slugs()` 헬퍼 추가.
- Create: `ai/tests/test_registry_uk_sponsor.py`
- Modify: `ai/app/db.py:83-93` — `fetch_unclear_jobs`에 `location, is_remote` 추가.
- Create: `ai/tests/test_fetch_unclear_jobs.py`
- Modify: `ai/app/etl/visa_reclassify.py` — `match_uk_register()` 순수 함수 + reclassify 파이프라인에 단계 삽입.
- Create: `ai/tests/test_match_uk_register.py`
- Create: `ai/scripts/verify_uk_sponsors.py` — 오프라인 검증 도구(정규화 매칭 순수 함수 포함).
- Create: `ai/tests/test_verify_uk_sponsors.py`
- Modify: `ai/dev_jobs_core/data/companies.json` — 검증 통과 회사에 `"uk_sponsor": true`.
- Modify: `ai/tests/test_companies_registry.py` — `uk_sponsor` bool 가드 추가.

---

### Task 1: `is_uk_location` analyzer

**Files:**
- Create: `ai/dev_jobs_core/analyzers/uk_location.py`
- Test: `ai/tests/test_uk_location.py`

- [ ] **Step 1: 실패하는 테스트 작성** — `ai/tests/test_uk_location.py`:

```python
from dev_jobs_core.analyzers.uk_location import is_uk_location


def test_uk_country_and_region_signals():
    assert is_uk_location("United Kingdom")
    assert is_uk_location("London, UK")
    assert is_uk_location("Edinburgh, Scotland")
    assert is_uk_location("Cardiff, Wales")
    assert is_uk_location("Belfast, Northern Ireland")


def test_uk_cities():
    for c in ["London", "Manchester", "Bristol", "Cambridge", "Leeds", "Glasgow"]:
        assert is_uk_location(c), c


def test_remote_uk():
    assert is_uk_location("Remote (UK)")
    assert is_uk_location("Remote - United Kingdom")
    assert is_uk_location("Remote", is_remote=True) is False  # 모호한 remote 는 UK 아님


def test_non_uk():
    for loc in ["Berlin, Germany", "New York, NY", "Remote - Europe",
                "Amsterdam", "Paris, France", "Remote"]:
        assert is_uk_location(loc) is False, loc


def test_empty():
    assert is_uk_location(None) is False
    assert is_uk_location("") is False


def test_word_boundary_no_false_positive():
    # 'uk' 가 단어 일부인 경우 오탐 금지
    assert is_uk_location("Fukuoka, Japan") is False
```

- [ ] **Step 2: 실패 확인** — `cd ai && uv run --extra dev python -m pytest tests/test_uk_location.py -v` → ModuleNotFoundError.

- [ ] **Step 3: 구현** — `ai/dev_jobs_core/analyzers/uk_location.py`:

```python
"""공고 location 문자열이 영국(UK) 소재인지 판별하는 휴리스틱. 순수 함수, 네트워크 없음.

UK 스폰서 라이선스는 UK 채용을 스폰서하므로, 회사가 명부에 있어도 공고가
UK 소재일 때만 sponsors 로 전환하기 위해 사용한다(보수적 게이팅).
"""
from __future__ import annotations

import re

# 국가/지역 신호 (단어경계)
_REGION = re.compile(
    r"\b(united kingdom|u\.k\.|uk|england|scotland|wales|northern ireland|great britain|gb)\b",
    re.IGNORECASE,
)
# 주요 UK 도시 (단어경계)
_CITIES = re.compile(
    r"\b(london|manchester|edinburgh|glasgow|birmingham|leeds|bristol|cardiff|"
    r"belfast|cambridge|oxford|liverpool|sheffield|nottingham|newcastle|"
    r"brighton|reading)\b",
    re.IGNORECASE,
)


def is_uk_location(location: str | None, is_remote: bool = False) -> bool:
    """location 이 UK 소재 신호를 가지면 True. 모호한 remote/EU/US/None 은 False."""
    if not location:
        return False
    text = location.strip()
    if not text:
        return False
    return bool(_REGION.search(text) or _CITIES.search(text))
```

> `is_remote` 인자는 인터페이스 일관성을 위해 받지만, 모호한 "Remote"는 UK 신호가 없으면 False다. "Remote (UK)"는 _REGION 이 잡는다. 현재 구현은 location 텍스트만으로 판정한다.

- [ ] **Step 4: 통과 확인** — `cd ai && uv run --extra dev python -m pytest tests/test_uk_location.py -v` → all pass.

- [ ] **Step 5: 커밋**

```bash
git add ai/dev_jobs_core/analyzers/uk_location.py ai/tests/test_uk_location.py
git commit -m "feat(visa): UK 소재 판별 휴리스틱 analyzer 추가"
```

---

### Task 2: `uk_sponsor_slugs()` 레지스트리 헬퍼

**Files:**
- Modify: `ai/dev_jobs_core/registry.py`
- Test: `ai/tests/test_registry_uk_sponsor.py`

- [ ] **Step 1: 실패하는 테스트 작성** — `ai/tests/test_registry_uk_sponsor.py`:

```python
from dev_jobs_core import registry


def test_uk_sponsor_slugs_returns_only_flagged(monkeypatch):
    fake = {
        "monzo": {"ats": "greenhouse", "token": "monzo", "uk_sponsor": True},
        "acme": {"ats": "lever", "token": "acme"},                 # 플래그 없음
        "beta": {"ats": "ashby", "token": "beta", "uk_sponsor": False},
        "_meta": {"description": "x"},
    }
    monkeypatch.setattr(registry, "_load", lambda: {k: v for k, v in fake.items() if not k.startswith("_")})
    slugs = registry.uk_sponsor_slugs()
    assert slugs == {"monzo"}


def test_uk_sponsor_slugs_real_registry_is_set():
    # 실제 레지스트리에서도 set 타입 반환 (값은 데이터에 따라 다름)
    assert isinstance(registry.uk_sponsor_slugs(), set)
```

- [ ] **Step 2: 실패 확인** — `cd ai && uv run --extra dev python -m pytest tests/test_registry_uk_sponsor.py -v` → AttributeError: module has no attribute 'uk_sponsor_slugs'.

- [ ] **Step 3: 구현** — `ai/dev_jobs_core/registry.py`의 `list_all` 아래(또는 `search_by_tag` 근처)에 추가:

```python
def uk_sponsor_slugs() -> set[str]:
    """UK 스폰서 라이선스 보유로 큐레이션된 회사(uk_sponsor=true)의 토큰 집합."""
    registry = _load()
    return {
        info["token"]
        for info in registry.values()
        if info.get("uk_sponsor") is True
    }
```

> `_load()`는 이미 `_meta` 등 `_` 시작 키를 제거한다(registry.py 참고).

- [ ] **Step 4: 통과 확인** — `cd ai && uv run --extra dev python -m pytest tests/test_registry_uk_sponsor.py -v` → pass.

- [ ] **Step 5: 커밋**

```bash
git add ai/dev_jobs_core/registry.py ai/tests/test_registry_uk_sponsor.py
git commit -m "feat(registry): uk_sponsor_slugs 헬퍼 추가"
```

---

### Task 3: `fetch_unclear_jobs`에 location·is_remote 추가

**Files:**
- Modify: `ai/app/db.py:83-93`
- Test: `ai/tests/test_fetch_unclear_jobs.py`

- [ ] **Step 1: 실패하는 테스트 작성** — `ai/tests/test_fetch_unclear_jobs.py` (가짜 conn 으로 DB 없이 매핑 검증):

```python
from app import db


class _FakeResult:
    def __init__(self, rows): self._rows = rows
    def fetchall(self): return self._rows


class _FakeConn:
    def __init__(self, rows): self._rows = rows; self.last_sql = None
    def execute(self, sql, params=None):
        self.last_sql = sql
        return _FakeResult(self._rows)


def test_fetch_unclear_jobs_maps_location_and_is_remote():
    rows = [("job1", "Backend Engineer", "desc text", "monzo", "London, UK", True)]
    conn = _FakeConn(rows)
    out = db.fetch_unclear_jobs(conn)
    assert out == [{
        "id": "job1", "title": "Backend Engineer", "description_text": "desc text",
        "company_slug": "monzo", "location": "London, UK", "is_remote": True,
    }]
    assert "location" in conn.last_sql and "is_remote" in conn.last_sql
```

- [ ] **Step 2: 실패 확인** — `cd ai && uv run --extra dev python -m pytest tests/test_fetch_unclear_jobs.py -v` → KeyError/AssertionError (location 없음).

- [ ] **Step 3: 구현** — `ai/app/db.py`의 `fetch_unclear_jobs`를 교체:

```python
def fetch_unclear_jobs(conn: psycopg.Connection, limit: int | None = None) -> list[dict[str, Any]]:
    sql = (
        "SELECT id, title, description_text, company_slug, location, is_remote FROM jobs "
        "WHERE is_active = true AND visa_status = 'unclear' "
        "ORDER BY posted_at DESC NULLS LAST"
    )
    rows = conn.execute(sql + (" LIMIT %s" if limit else ""), (limit,) if limit else None).fetchall()
    return [
        {"id": r[0], "title": r[1], "description_text": r[2], "company_slug": r[3],
         "location": r[4], "is_remote": r[5]}
        for r in rows
    ]
```

- [ ] **Step 4: 통과 확인** — `cd ai && uv run --extra dev python -m pytest tests/test_fetch_unclear_jobs.py -v` → pass.

- [ ] **Step 5: 커밋**

```bash
git add ai/app/db.py ai/tests/test_fetch_unclear_jobs.py
git commit -m "feat(db): fetch_unclear_jobs 에 location·is_remote 추가"
```

---

### Task 4: `match_uk_register` 순수 매칭 함수

**Files:**
- Modify: `ai/app/etl/visa_reclassify.py` (함수만 추가; 파이프라인 배선은 Task 5)
- Test: `ai/tests/test_match_uk_register.py`

- [ ] **Step 1: 실패하는 테스트 작성** — `ai/tests/test_match_uk_register.py`:

```python
from app.etl.visa_reclassify import match_uk_register, UK_EVIDENCE


def _job(jid, slug, loc, remote=False):
    return {"id": jid, "company_slug": slug, "location": loc, "is_remote": remote}


def test_flagged_company_uk_location_matches():
    jobs = [_job("j1", "monzo", "London, UK")]
    out = match_uk_register(jobs, {"monzo"})
    assert out == {"j1": ("sponsors", [UK_EVIDENCE])}


def test_flagged_company_non_uk_location_skipped():
    jobs = [_job("j2", "monzo", "Berlin, Germany")]
    assert match_uk_register(jobs, {"monzo"}) == {}


def test_non_flagged_company_skipped():
    jobs = [_job("j3", "randomco", "London, UK")]
    assert match_uk_register(jobs, {"monzo"}) == {}


def test_empty_location_skipped():
    jobs = [_job("j4", "monzo", None)]
    assert match_uk_register(jobs, {"monzo"}) == {}
```

- [ ] **Step 2: 실패 확인** — `cd ai && uv run --extra dev python -m pytest tests/test_match_uk_register.py -v` → ImportError (match_uk_register 없음).

- [ ] **Step 3: 구현** — `ai/app/etl/visa_reclassify.py` 상단(임포트 직후, `reclassify_unclear_visa` 위)에 추가. 임포트에 analyzer/registry 추가:

```python
from dev_jobs_core.analyzers.uk_location import is_uk_location
from dev_jobs_core.registry import uk_sponsor_slugs
```

함수:

```python
UK_EVIDENCE = "회사가 UK 스폰서 라이선스 보유 (Home Office 등록 스폰서 명부)"


def match_uk_register(jobs: list[dict], uk_slugs: set[str]) -> dict[str, tuple[str, list[str]]]:
    """unclear 공고 중 (회사가 UK 스폰서 + UK 소재)인 것을 sponsors 로 매핑.

    순수 함수(DB/네트워크 없음). 입력 jobs 는 fetch_unclear_jobs 형식 dict.
    """
    out: dict[str, tuple[str, list[str]]] = {}
    for j in jobs:
        if j.get("company_slug") in uk_slugs and is_uk_location(
            j.get("location"), j.get("is_remote", False)
        ):
            out[j["id"]] = ("sponsors", [UK_EVIDENCE])
    return out
```

- [ ] **Step 4: 통과 확인** — `cd ai && uv run --extra dev python -m pytest tests/test_match_uk_register.py -v` → 4 pass.

- [ ] **Step 5: 커밋**

```bash
git add ai/app/etl/visa_reclassify.py ai/tests/test_match_uk_register.py
git commit -m "feat(visa): UK 레지스터 매칭 순수 함수 match_uk_register 추가"
```

---

### Task 5: reclassify 파이프라인에 UK 단계 배선

keyword 단계 직후, LLM 앞에 UK 매칭을 삽입하고 `by_uk_register` 통계를 추가한다. DB 통합 테스트는 이 repo에 없으므로(전부 순수 테스트), 배선은 Task 4의 검증된 순수 함수 조합으로 신뢰한다.

**Files:**
- Modify: `ai/app/etl/visa_reclassify.py` (`reclassify_unclear_visa` 본문)

- [ ] **Step 1: 현재 함수 확인**

`reclassify_unclear_visa`는 (1) 키워드로 `remaining` 산출, (2) LLM, (3) 회사추론, (4) UPDATE 순서다. 키워드 루프가 `remaining` 리스트를 만든다(아직 unclear인 job).

- [ ] **Step 2: UK 단계 삽입**

키워드 단계가 `remaining`을 만든 직후(LLM 블록 `# 2) LLM` 바로 위)에 삽입:

```python
        # 1.5) UK 스폰서 레지스터 매칭 (무료·사실 기반, LLM 앞에서 비용 절감)
        uk_slugs = uk_sponsor_slugs()
        uk_hits = match_uk_register(remaining, uk_slugs)
        by_uk_register = len(uk_hits)
        results.update(uk_hits)
        remaining = [j for j in remaining if j["id"] not in uk_hits]
```

- [ ] **Step 3: 통계 반환에 추가**

`return { ... }` dict 에 `"by_uk_register": by_uk_register,` 를 `by_keyword` 다음에 추가.

- [ ] **Step 4: 회귀 확인**

기존 reclassify 관련 테스트가 없으므로 import/문법 회귀만 확인:

Run: `cd ai && uv run --extra dev python -c "from app.etl.visa_reclassify import reclassify_unclear_visa, match_uk_register, UK_EVIDENCE; print('ok')"`
Expected: `ok`

그리고 전체 단위 테스트 무회귀: `cd ai && uv run --extra dev python -m pytest tests/test_match_uk_register.py tests/test_uk_location.py -v` → pass.

- [ ] **Step 5: 커밋**

```bash
git add ai/app/etl/visa_reclassify.py
git commit -m "feat(visa): reclassify 에 UK 레지스터 단계 삽입 (LLM 앞) + by_uk_register 통계"
```

---

### Task 6: 오프라인 검증 스크립트 + 정규화 매칭

**Files:**
- Create: `ai/scripts/verify_uk_sponsors.py`
- Test: `ai/tests/test_verify_uk_sponsors.py`

매칭 철학(중요): 회사명 매칭은 본질적으로 모호하다("Monzo Bank Ltd"는 진짜 Monzo지만 "Asana Healthcare Ltd"는 다른 회사인데 둘 다 접두 일치한다). 그래서 `match_company`는 **후보를 관대하게 제안**하고, **정밀도는 Task 7의 사람 검토 단계**가 책임진다. 코드가 동음이의어를 자동 거부하려 하지 않는다(불가능·과설계). 코드가 거부하는 건 "공유 접두가 전혀 없는" 명백한 무관 케이스뿐이다.

- [ ] **Step 1: 실패하는 테스트 작성** — `ai/tests/test_verify_uk_sponsors.py` (정규화 매칭 순수 함수만 테스트):

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
import verify_uk_sponsors as v


def test_normalize_strips_legal_and_geo_suffixes_only():
    # 법인/지역 접미사만 제거. 업종어(bank/payments)는 유지(회사 구분에 필요).
    assert v.normalize("Monzo Bank Ltd") == "monzo bank"
    assert v.normalize("GoCardless Limited") == "gocardless"
    assert v.normalize("Stripe Payments UK Ltd") == "stripe payments"


def test_match_exact():
    assert v.match_company("gocardless", "GoCardless Limited") is True


def test_match_prefix_proposes_candidate():
    # 접두 일치는 후보로 제안(사람이 최종 검토). Monzo Bank, Stripe Payments 등.
    assert v.match_company("monzo", "Monzo Bank Ltd") is True
    assert v.match_company("stripe", "Stripe Payments UK Ltd") is True
    # 동음이의어도 후보로는 잡힌다 — 거부는 사람 몫(코드 아님).
    assert v.match_company("asana", "Asana Healthcare Ltd") is True


def test_match_rejects_unrelated():
    # 공유 접두가 없는 명백한 무관 케이스만 코드가 거부.
    assert v.match_company("monzo", "Bossmans Retail Abergavenny Ltd") is False
    assert v.match_company("gocardless", "Boltwhiz Limited") is False


def test_short_name_requires_exact():
    # 4자 미만 브랜드는 접두 허용 안 함(정확 일치만) — 오탐 폭주 방지.
    assert v.match_company("n8n", "n8n GmbH") is True
    assert v.match_company("n8n", "n8n Solutions Ltd") is False
```

- [ ] **Step 2: 실패 확인** — `cd ai && uv run --extra dev python -m pytest tests/test_verify_uk_sponsors.py -v` → ModuleNotFoundError / AttributeError.

- [ ] **Step 3: 구현** — `ai/scripts/verify_uk_sponsors.py`:

```python
"""UK 스폰서 명부 대조 검증 도구(오프라인, 일회성/주기적).

레지스트리 회사를 Home Office 'Register of licensed sponsors: workers' CSV 와
정밀 매칭해 후보를 출력한다. 사람이 검토 후 companies.json 에 "uk_sponsor": true
를 수동 반영한다. 런타임 ETL 과 무관.

사용:
  python scripts/verify_uk_sponsors.py /path/to/register.csv
  python scripts/verify_uk_sponsors.py            # gov.uk 에서 당일 CSV 자동 다운로드
"""
from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path
from urllib.request import Request, urlopen

PUBLICATION = "https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers"
REGISTRY_PATH = Path(__file__).parent.parent / "dev_jobs_core" / "data" / "companies.json"

# 법인/지역 접미사만 제거(업종어 bank/payments 등은 회사 구분에 필요하므로 유지).
# 구두점은 normalize 에서 공백으로 치환되므로 토큰 단위로만 매칭한다.
_SUFFIX = re.compile(
    r"\b(ltd|limited|plc|inc|llc|gmbh|llp|group|holdings|uk|europe|international|branch|ab|se)\b"
)


def normalize(name: str) -> str:
    s = (name or "").lower()
    s = re.sub(r"[^a-z0-9 ]", " ", s)   # 구두점 -> 공백 (N.V. -> n v)
    s = _SUFFIX.sub(" ", s)
    return re.sub(r"\s+", " ", s).strip()


def match_company(brand: str, org_name: str) -> bool:
    """우리 회사 brand(토큰/이름)가 명부 org_name 과 정밀 매칭하는지.

    규칙: 정규화 후 정확 일치, 또는 (brand 길이>=4 일 때) org 가 'brand ' 로 시작.
    짧은(<4) 브랜드는 정확 일치만 허용(오탐 방지).
    """
    nb = normalize(brand)
    no = normalize(org_name)
    if not nb or not no:
        return False
    if no == nb:
        return True
    if len(nb) >= 4 and no.startswith(nb + " "):
        # 단, 첫 토큰이 정확히 brand 와 같아야 함(부분어 방지)
        return no.split(" ", 1)[0] == nb
    return False


def _fetch_csv_url() -> str:
    req = Request(PUBLICATION, headers={"User-Agent": "Mozilla/5.0"})
    html = urlopen(req, timeout=30).read().decode("utf-8", "replace")
    m = re.search(r'https://[^\s"\']+\.csv', html)
    if not m:
        raise SystemExit("CSV 링크를 publication 페이지에서 못 찾음")
    return m.group(0)


def _load_register(path: str | None) -> list[str]:
    if path:
        f = open(path, newline="", encoding="utf-8", errors="replace")
    else:
        url = _fetch_csv_url()
        req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
        import io
        data = urlopen(req, timeout=120).read().decode("utf-8", "replace")
        f = io.StringIO(data)
    with f:
        return [row["Organisation Name"].strip() for row in csv.DictReader(f)]


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else None
    orgs = _load_register(path)
    data = json.load(open(REGISTRY_PATH))
    cos = {k: v for k, v in data.items() if not k.startswith("_")}

    # 명부 정규화 인덱스: normalized -> 원본 org명
    reg_index: dict[str, str] = {}
    for on in orgs:
        reg_index.setdefault(normalize(on), on)

    hits = []
    for name, info in cos.items():
        for brand in {name, info.get("token", "")}:
            matched = None
            for non, on in reg_index.items():
                if match_company(brand, on):
                    matched = on
                    break
            if matched:
                hits.append((name, info.get("ats"), matched, info.get("uk_sponsor") is True))
                break

    print(f"=== UK 명부 매칭 후보: {len(hits)}/{len(cos)} (검토 후 companies.json 반영) ===")
    for name, ats, org, already in sorted(hits):
        flag = " [이미 플래그됨]" if already else ""
        print(f"  {name:<16} [{ats}] -> {org}{flag}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: 통과 확인** — `cd ai && uv run --extra dev python -m pytest tests/test_verify_uk_sponsors.py -v` → pass. (마지막 케이스 기대값은 구현 규칙에 맞춰 조정.)

- [ ] **Step 5: 커밋**

```bash
git add ai/scripts/verify_uk_sponsors.py ai/tests/test_verify_uk_sponsors.py
git commit -m "feat(scripts): UK 스폰서 명부 검증 도구 + 정밀 정규화 매칭"
```

---

### Task 7: 검증 실행 → 플래그 반영 + 가드 테스트 확장

**Files:**
- Modify: `ai/dev_jobs_core/data/companies.json` (`uk_sponsor: true` 추가)
- Modify: `ai/tests/test_companies_registry.py` (bool 가드)

- [ ] **Step 1: 검증 스크립트 실행 (운영 단계, 네트워크)**

Run: `cd ai && uv run python scripts/verify_uk_sponsors.py`
명부에서 당일 CSV를 받아 매칭 후보를 출력한다. (네트워크 실패 시 CSV를 수동 다운로드해 경로 인자로 재실행.)

- [ ] **Step 2: 후보 검토 → 오탐 제거**

출력된 후보에서 명백한 동음이의어 오탐을 사람이 제거한다(예: asana→Asana Healthcare, notion→Notion Capital, dropbox→Dropbox Fuels, elastic→Elastic Path, linear→Linear Design, runway→Runway Agency, prefect→Prefect Accountants 등). 매칭 org명이 우리 회사의 실제 UK 법인으로 합당한 것만 채택.

- [ ] **Step 3: companies.json에 플래그 반영**

채택된 회사 항목에 `"uk_sponsor": true` 추가. 예:

```json
"monzo": {"ats": "greenhouse", "token": "monzo", "tags": ["fintech", "europe"], "uk_sponsor": true},
```

다른 필드(ats/token/tags) 변경 금지. `_meta` 불변.

- [ ] **Step 4: 가드 테스트 확장** — `ai/tests/test_companies_registry.py`에 추가:

```python
def test_uk_sponsor_flag_is_bool_when_present():
    data = _load()
    for name, info in data.items():
        if name.startswith("_"):
            continue
        if "uk_sponsor" in info:
            assert isinstance(info["uk_sponsor"], bool), f"{name}: uk_sponsor not bool"
```

- [ ] **Step 5: 검증 + 커밋**

```bash
cd ai && uv run --extra dev python -m pytest tests/test_companies_registry.py -v   # 4 pass
cd ai && uv run python -c "from dev_jobs_core.registry import uk_sponsor_slugs; print('uk_sponsor 회사:', len(uk_sponsor_slugs()))"
```
Expected: 가드 4 pass, uk_sponsor 회사 수 > 0 출력.

```bash
git add ai/dev_jobs_core/data/companies.json ai/tests/test_companies_registry.py
git commit -m "feat(registry): 검증된 UK 스폰서 회사에 uk_sponsor 플래그 + bool 가드"
```

---

### Task 8: 전체 테스트 + 최종 확인

- [ ] **Step 1: 전체 단위 테스트**

Run: `cd ai && uv run --extra dev python -m pytest tests/ -q`
Expected: 전부 PASS(신규 test_uk_location / test_registry_uk_sponsor / test_fetch_unclear_jobs / test_match_uk_register / test_verify_uk_sponsors + 확장된 test_companies_registry 포함, 기존 무회귀).

- [ ] **Step 2: 커밋 요약**

Run: `git log --oneline origin/main..HEAD`
Expected: Task 1~7 커밋(스펙/플랜 docs 포함). Task 1 운영 실행(Task7 Step1)은 커밋 없음.

> 라이브 reclassify 실행으로 실제 unclear→sponsors 전환 건수(`by_uk_register`)를 확인하는 것은 머지 후 운영 ETL 단계에서 수행한다(이 플랜 범위는 코드·플래그·테스트까지).

---

## Self-Review

- **Spec coverage:** §4.1 플래그 → Task 7. §4.2 uk_sponsor_slugs → Task 2. §4.3 is_uk_location → Task 1. §4.4 fetch_unclear_jobs → Task 3. §4.5 reclassify 단계 → Task 4(순수함수)+Task 5(배선). §4.6 검증 스크립트 → Task 6+7. §6 테스트 → 각 Task. §5 엣지(None location/no_sponsor 미조회) → Task 1·4 테스트로 커버. 누락 없음.
- **Placeholder scan:** TBD/TODO 없음. Task 6/7의 후보 회사 목록은 검증 게이트(운영 단계)를 거치므로 플레이스홀더 아님. 모든 코드 스텝에 실제 코드 포함.
- **Type consistency:** `match_uk_register(jobs: list[dict], uk_slugs: set[str]) -> dict[str, tuple[str, list[str]]]`가 Task 4 정의와 Task 5 호출부 일치. `is_uk_location(location, is_remote=False) -> bool` Task 1 정의와 Task 4 호출 일치. `uk_sponsor_slugs() -> set[str]` Task 2 정의와 Task 5 호출 일치. `fetch_unclear_jobs` 반환 dict 키(id/title/description_text/company_slug/location/is_remote)가 Task 3 정의와 Task 4/5 사용 일치. `UK_EVIDENCE` 상수 Task 4 정의·테스트·Task 5 동일 참조.
