# US H-1B 스폰서 대조 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** USCIS H-1B Employer Data Hub에 승인 이력이 있는 회사의 미국 소재 unclear 공고를 `sponsors`로 사실 기반 전환한다.

**Architecture:** UK 레지스터 레버([[uk-sponsor-register-feature]])의 미국판 미러. 데이터 CSV는 오프라인 검증 스크립트에서만 사용해 `companies.json`에 `h1b_sponsor: true`를 큐레이션한다. 런타임 reclassify는 그 플래그(레지스트리)와 `is_us_location` 휴리스틱으로, UK 단계 직후·LLM 앞에 unclear 공고를 전환한다. 매칭은 순수 함수로 분리해 DB 없이 테스트한다.

**Tech Stack:** Python 3 / psycopg / pytest / 표준 라이브러리(csv, re) / 기존 `visa_reclassify` 파이프라인.

설계 전문: `docs/superpowers/specs/2026-05-30-us-h1b-register-design.md`.

> 모든 테스트/명령은 `ai/`에서 `uv run --extra dev python -m pytest ...`로 실행한다(`cd ai`). 테스트는 네트워크·DB를 타지 않는다. 신규 파일은 ruff clean 유지(unused import 금지). `fetch_unclear_jobs`는 이미 `location, is_remote`를 반환하므로(UK 레버에서 추가됨) DB 변경 없음.

---

## File Structure

- Create: `ai/dev_jobs_core/analyzers/us_location.py` — `is_us_location()` 순수 휴리스틱.
- Create: `ai/tests/test_us_location.py`
- Modify: `ai/dev_jobs_core/registry.py` — `h1b_sponsor_slugs()` 헬퍼.
- Create: `ai/tests/test_registry_h1b_sponsor.py`
- Modify: `ai/app/etl/visa_reclassify.py` — `match_h1b_register()` + reclassify 단계 삽입.
- Create: `ai/tests/test_match_h1b_register.py`
- Create: `ai/scripts/verify_h1b_sponsors.py` — 오프라인 검증 도구(UK 스크립트의 normalize/match_company 재사용).
- Create: `ai/tests/test_verify_h1b_sponsors.py`
- Modify: `ai/dev_jobs_core/data/companies.json` — 검증 통과 회사에 `"h1b_sponsor": true`.
- Modify: `ai/tests/test_companies_registry.py` — `h1b_sponsor` bool 가드.

---

### Task 1: `is_us_location` analyzer

**Files:**
- Create: `ai/dev_jobs_core/analyzers/us_location.py`
- Test: `ai/tests/test_us_location.py`

- [ ] **Step 1: 실패하는 테스트 작성** — `ai/tests/test_us_location.py`:

```python
from dev_jobs_core.analyzers.us_location import is_us_location


def test_strong_country_signals():
    assert is_us_location("United States")
    assert is_us_location("Remote, USA")
    assert is_us_location("Remote (US)")
    assert is_us_location("Remote - United States")


def test_full_state_names():
    for s in ["San Jose, California", "Austin, Texas", "Seattle, Washington",
              "Denver, Colorado", "Boston, Massachusetts"]:
        assert is_us_location(s), s


def test_major_cities():
    for c in ["San Francisco", "New York", "Seattle", "Austin", "Mountain View", "Palo Alto"]:
        assert is_us_location(c), c


def test_state_abbreviation_only_in_comma_pattern():
    assert is_us_location("Austin, TX")
    assert is_us_location("San Francisco, CA")
    assert is_us_location("New York, NY")


def test_no_false_positive_from_lowercase_words():
    # 주 약어와 충돌하는 영어 단어는 매칭 금지
    for loc in ["Remote or hybrid", "working in office", "ok with remote",
                "call me maybe"]:
        assert is_us_location(loc) is False, loc


def test_non_us():
    for loc in ["Berlin, Germany", "London, UK", "Remote - Europe",
                "Amsterdam", "Paris, France", "Remote"]:
        assert is_us_location(loc) is False, loc


def test_empty():
    assert is_us_location(None) is False
    assert is_us_location("") is False
```

- [ ] **Step 2: 실패 확인** — `cd ai && uv run --extra dev python -m pytest tests/test_us_location.py -v` → ModuleNotFoundError.

- [ ] **Step 3: 구현** — `ai/dev_jobs_core/analyzers/us_location.py`:

```python
"""공고 location 문자열이 미국(US) 소재인지 판별하는 휴리스틱. 순수 함수, 네트워크 없음.

H-1B 는 미국 비자이므로, 회사가 H-1B 스폰서 이력이 있어도 공고가 미국 소재일 때만
sponsors 로 전환하기 위해 사용한다(보수적 게이팅).

주의: 2글자 주 약어(TX, CA …)는 영어 단어(or, in, me, ok …)와 충돌하므로
"City, XX" 콤마 패턴 + 대문자에서만 인정한다.
"""
from __future__ import annotations

import re

# 강한 국가 신호. "United States"/"USA" 는 대소문자 무관, 단독 US/U.S. 는 대문자만(소문자 "us" 오탐 방지).
_COUNTRY_CI = re.compile(r"\b(united states|usa)\b", re.IGNORECASE)
_COUNTRY_CS = re.compile(r"\b(US|U\.S\.|U\.S\.A\.)\b")  # 대소문자 구분(대문자만)

# 전체 주 이름 + DC (단어경계)
_STATES_FULL = re.compile(
    r"\b(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|"
    r"florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|"
    r"maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|"
    r"nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|"
    r"north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|"
    r"south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|"
    r"wisconsin|wyoming|district of columbia)\b",
    re.IGNORECASE,
)
# 주요 US 도시 (단어경계)
_CITIES = re.compile(
    r"\b(new york|san francisco|seattle|austin|boston|chicago|los angeles|denver|"
    r"atlanta|mountain view|palo alto|san jose|sunnyvale|cupertino|san diego|dallas|"
    r"houston|miami|philadelphia|portland|nashville|brooklyn|menlo park|santa clara|"
    r"bellevue|redmond)\b",
    re.IGNORECASE,
)
# 2글자 주 약어: ", XX" 패턴 + 대문자에서만 (re.IGNORECASE 쓰지 않음)
_STATE_ABBR = re.compile(
    r",\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|"
    r"MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|"
    r"WI|WY|DC)\b"
)


def is_us_location(location: str | None, is_remote: bool = False) -> bool:
    """location 이 미국 소재 신호를 가지면 True. EU/UK/모호한 remote/None 은 False."""
    if not location:
        return False
    text = location.strip()
    if not text:
        return False
    return bool(
        _COUNTRY_CI.search(text)
        or _COUNTRY_CS.search(text)
        or _STATES_FULL.search(text)
        or _CITIES.search(text)
        or _STATE_ABBR.search(text)
    )
```

> 알려진 한계: "Washington"(주/DC)·"Cambridge"(MA vs 영국) 등 UK와 겹치는 도시가 있으나, reclassify에서 UK 단계가 먼저 돌고(같은 회사가 둘 다면 UK가 선점) H-1B는 회사 플래그 AND US위치 이중 게이트라 위험 범위가 좁다. 결과가 사용자 유리 방향.

- [ ] **Step 4: 통과 확인** — `cd ai && uv run --extra dev python -m pytest tests/test_us_location.py -v` → all pass. 특히 `test_no_false_positive_from_lowercase_words`가 통과해야 한다(소문자 or/in/me/ok 비매칭). 실패 시 정규식을 고치되 테스트는 약화하지 말 것.

- [ ] **Step 5: 커밋**

```bash
git add ai/dev_jobs_core/analyzers/us_location.py ai/tests/test_us_location.py
git commit -m "feat(visa): US 소재 판별 휴리스틱 analyzer 추가"
```

---

### Task 2: `h1b_sponsor_slugs()` 레지스트리 헬퍼

**Files:**
- Modify: `ai/dev_jobs_core/registry.py` (기존 `uk_sponsor_slugs` 바로 아래)
- Test: `ai/tests/test_registry_h1b_sponsor.py`

- [ ] **Step 1: 실패하는 테스트 작성** — `ai/tests/test_registry_h1b_sponsor.py`:

```python
from dev_jobs_core import registry


def test_h1b_sponsor_slugs_returns_only_flagged(monkeypatch):
    fake = {
        "stripe": {"ats": "greenhouse", "token": "stripe", "h1b_sponsor": True},
        "acme": {"ats": "lever", "token": "acme"},
        "beta": {"ats": "ashby", "token": "beta", "h1b_sponsor": False},
        "_meta": {"description": "x"},
    }
    monkeypatch.setattr(registry, "_load", lambda: {k: v for k, v in fake.items() if not k.startswith("_")})
    assert registry.h1b_sponsor_slugs() == {"stripe"}


def test_h1b_sponsor_slugs_real_registry_is_set():
    assert isinstance(registry.h1b_sponsor_slugs(), set)
```

- [ ] **Step 2: 실패 확인** — `cd ai && uv run --extra dev python -m pytest tests/test_registry_h1b_sponsor.py -v` → AttributeError.

- [ ] **Step 3: 구현** — `ai/dev_jobs_core/registry.py`의 `uk_sponsor_slugs` 함수 바로 아래에 추가:

```python
def h1b_sponsor_slugs() -> set[str]:
    """US H-1B 스폰서 이력 보유로 큐레이션된 회사(h1b_sponsor=true)의 토큰 집합."""
    registry = _load()
    return {
        info["token"]
        for info in registry.values()
        if info.get("h1b_sponsor") is True
    }
```

- [ ] **Step 4: 통과 확인** — `cd ai && uv run --extra dev python -m pytest tests/test_registry_h1b_sponsor.py -v` → 2 pass.

- [ ] **Step 5: 커밋**

```bash
git add ai/dev_jobs_core/registry.py ai/tests/test_registry_h1b_sponsor.py
git commit -m "feat(registry): h1b_sponsor_slugs 헬퍼 추가"
```

---

### Task 3: `match_h1b_register` 순수 함수

**Files:**
- Modify: `ai/app/etl/visa_reclassify.py` (함수만 추가; 배선은 Task 4)
- Test: `ai/tests/test_match_h1b_register.py`

- [ ] **Step 1: 실패하는 테스트 작성** — `ai/tests/test_match_h1b_register.py`:

```python
from app.etl.visa_reclassify import match_h1b_register, H1B_EVIDENCE


def _job(jid, slug, loc, remote=False):
    return {"id": jid, "company_slug": slug, "location": loc, "is_remote": remote}


def test_flagged_company_us_location_matches():
    jobs = [_job("j1", "stripe", "San Francisco, CA")]
    assert match_h1b_register(jobs, {"stripe"}) == {"j1": ("sponsors", [H1B_EVIDENCE])}


def test_flagged_company_non_us_location_skipped():
    jobs = [_job("j2", "stripe", "Berlin, Germany")]
    assert match_h1b_register(jobs, {"stripe"}) == {}


def test_non_flagged_company_skipped():
    jobs = [_job("j3", "randomco", "Austin, TX")]
    assert match_h1b_register(jobs, {"stripe"}) == {}


def test_empty_location_skipped():
    jobs = [_job("j4", "stripe", None)]
    assert match_h1b_register(jobs, {"stripe"}) == {}
```

- [ ] **Step 2: 실패 확인** — `cd ai && uv run --extra dev python -m pytest tests/test_match_h1b_register.py -v` → ImportError.

- [ ] **Step 3: 구현** — `ai/app/etl/visa_reclassify.py`. import 블록에 추가(기존 `is_uk_location`, `uk_sponsor_slugs` 옆):

```python
from dev_jobs_core.analyzers.us_location import is_us_location
from dev_jobs_core.registry import h1b_sponsor_slugs
```

`UK_EVIDENCE`/`match_uk_register` 아래에 추가:

```python
H1B_EVIDENCE = "회사가 미국 H-1B 스폰서 이력 보유 (USCIS Employer Data Hub)"


def match_h1b_register(jobs: list[dict], h1b_slugs: set[str]) -> dict[str, tuple[str, list[str]]]:
    """unclear 공고 중 (회사가 H-1B 스폰서 + 미국 소재)인 것을 sponsors 로 매핑.

    순수 함수(DB/네트워크 없음). 입력 jobs 는 fetch_unclear_jobs 형식 dict.
    """
    out: dict[str, tuple[str, list[str]]] = {}
    for j in jobs:
        if j.get("company_slug") in h1b_slugs and is_us_location(
            j.get("location"), j.get("is_remote", False)
        ):
            out[j["id"]] = ("sponsors", [H1B_EVIDENCE])
    return out
```

> import 두 줄은 Task 4에서 reclassify 본문이 사용한다. 이 Task 시점엔 `h1b_sponsor_slugs`가 미사용이라 ruff F401이 날 수 있으니, **`is_us_location`만 지금 추가**하고 `h1b_sponsor_slugs` import는 Task 4에서 추가한다(UK 때와 동일 패턴). `match_h1b_register`는 `is_us_location`만 쓴다.

- [ ] **Step 4: 통과 확인** — `cd ai && uv run --extra dev python -m pytest tests/test_match_h1b_register.py -v` → 4 pass. ruff: `cd ai && uv run ruff check app/etl/visa_reclassify.py` → clean.

- [ ] **Step 5: 커밋**

```bash
git add ai/app/etl/visa_reclassify.py ai/tests/test_match_h1b_register.py
git commit -m "feat(visa): H-1B 매칭 순수 함수 match_h1b_register 추가"
```

---

### Task 4: reclassify 파이프라인에 H-1B 단계 배선

UK 단계 **직후**, LLM 앞에 H-1B 매칭을 삽입한다.

**Files:**
- Modify: `ai/app/etl/visa_reclassify.py`

- [ ] **Step 1: import 추가**

import 블록에 추가(아직 없으면):
```python
from dev_jobs_core.registry import h1b_sponsor_slugs
```
(기존 `from dev_jobs_core.registry import uk_sponsor_slugs` 라인을 `uk_sponsor_slugs, h1b_sponsor_slugs` 로 합쳐도 됨.)

- [ ] **Step 2: H-1B 단계 삽입**

기존 UK 블록:
```python
        # 1.5) UK 스폰서 레지스터 매칭 (무료·사실 기반, LLM 앞에서 비용 절감)
        uk_slugs = uk_sponsor_slugs()
        uk_hits = match_uk_register(remaining, uk_slugs)
        by_uk_register = len(uk_hits)
        results.update(uk_hits)
        remaining = [j for j in remaining if j["id"] not in uk_hits]
```
바로 **아래**에 추가:
```python
        # 1.6) US H-1B 스폰서 매칭 (무료·사실 기반, UK 직후·LLM 앞)
        h1b_hits = match_h1b_register(remaining, h1b_sponsor_slugs())
        by_h1b_register = len(h1b_hits)
        results.update(h1b_hits)
        remaining = [j for j in remaining if j["id"] not in h1b_hits]
```

- [ ] **Step 3: 통계 반환에 추가**

`return { ... }` dict 에서 `"by_uk_register": by_uk_register,` 바로 다음에 `"by_h1b_register": by_h1b_register,` 추가.

- [ ] **Step 4: 회귀 확인**

```
cd ai && uv run --extra dev python -c "from app.etl.visa_reclassify import reclassify_unclear_visa, match_h1b_register, H1B_EVIDENCE; from dev_jobs_core.registry import h1b_sponsor_slugs; print('ok')"
cd ai && uv run --extra dev python -m pytest tests/test_match_h1b_register.py tests/test_match_uk_register.py tests/test_us_location.py -q
cd ai && uv run ruff check app/etl/visa_reclassify.py
```
Expect: `ok`, 테스트 pass, ruff clean.

- [ ] **Step 5: 커밋**

```bash
git add ai/app/etl/visa_reclassify.py
git commit -m "feat(visa): reclassify 에 H-1B 단계 삽입 (UK 직후·LLM 앞) + by_h1b_register 통계"
```

---

### Task 5: 오프라인 검증 스크립트 + 승인이력 필터

UK 스크립트의 `normalize`/`match_company`를 재사용(DRY)하고, H-1B 특유의 CSV 파싱(고용주명 + 승인이력 컬럼 탐지 + approvals≥1 필터)만 새로 작성한다.

**Files:**
- Create: `ai/scripts/verify_h1b_sponsors.py`
- Test: `ai/tests/test_verify_h1b_sponsors.py`

- [ ] **Step 1: 실패하는 테스트 작성** — `ai/tests/test_verify_h1b_sponsors.py`:

```python
import io
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
import verify_h1b_sponsors as v

# USCIS Employer Data Hub 형식(연도별 헤더가 조금씩 달라 컬럼명 탐지로 처리).
CSV = (
    "Fiscal Year,Employer (Petitioner) Name,Initial Approval,Initial Denial,"
    "Continuing Approval,Continuing Denial,Petitioner City,Petitioner State\n"
    "2024,STRIPE INC,12,0,8,1,SOUTH SAN FRANCISCO,CA\n"
    "2024,SOME RANDOM LLC,0,3,0,0,AUSTIN,TX\n"          # 승인 0 -> 제외
    "2024,DATABRICKS INC,40,2,15,0,SAN FRANCISCO,CA\n"
)


def test_parse_approved_employers_filters_zero_approvals():
    emps = v.parse_approved_employers(io.StringIO(CSV))
    names = {e.lower() for e in emps}
    assert any("stripe" in n for n in names)
    assert any("databricks" in n for n in names)
    assert not any("some random" in n for n in names)   # 승인 0 제외


def test_reuses_uk_matchers():
    # UK 스크립트의 정밀 매칭 재사용(동일 동작)
    assert v.match_company("stripe", "STRIPE INC") is True
    assert v.match_company("databricks", "DATABRICKS INC") is True
    assert v.match_company("monzo", "Some Random LLC") is False
```

- [ ] **Step 2: 실패 확인** — `cd ai && uv run --extra dev python -m pytest tests/test_verify_h1b_sponsors.py -v` → ModuleNotFoundError/AttributeError.

- [ ] **Step 3: 구현** — `ai/scripts/verify_h1b_sponsors.py`:

```python
"""USCIS H-1B Employer Data Hub 대조 검증 도구(오프라인, 일회성/주기적).

레지스트리 회사를 H-1B 고용주 명단과 정밀 매칭해 후보를 출력한다(승인 이력 있는
고용주만). 사람이 검토 후 companies.json 에 "h1b_sponsor": true 를 수동 반영한다.
런타임 ETL 과 무관.

USCIS 는 자동 다운로드를 차단할 수 있어 CSV 경로를 인자로 받는다(수동 다운로드):
  https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub 에서
  연도별 CSV 를 받아:
    python scripts/verify_h1b_sponsors.py /path/to/h1b_datahub_export.csv
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

# UK 스크립트의 정밀 정규화 매칭 재사용(DRY). 둘 다 main()에서 사용 + 테스트가 v.match_company/v.normalize 참조.
from verify_uk_sponsors import match_company, normalize

REGISTRY_PATH = Path(__file__).parent.parent / "dev_jobs_core" / "data" / "companies.json"


def _find_col(fieldnames: list[str], *needles: str) -> str | None:
    for f in fieldnames:
        low = f.lower()
        if all(n in low for n in needles):
            return f
    return None


def parse_approved_employers(fp) -> list[str]:
    """CSV(파일객체)에서 승인 이력(initial+continuing approval 합 >= 1) 있는 고용주명 목록.

    연도별 헤더 변형에 견디도록 컬럼명을 부분일치로 탐지한다.
    """
    reader = csv.DictReader(fp)
    fields = reader.fieldnames or []
    name_col = _find_col(fields, "employer") or _find_col(fields, "petitioner")
    init_col = _find_col(fields, "initial", "approval")
    cont_col = _find_col(fields, "continuing", "approval")
    if not name_col:
        raise SystemExit(f"고용주명 컬럼을 못 찾음. 헤더: {fields}")

    def _num(row, col):
        if not col:
            return 0
        raw = (row.get(col) or "0").replace(",", "").strip()
        try:
            return int(float(raw))
        except ValueError:
            return 0

    out = []
    for row in reader:
        approvals = _num(row, init_col) + _num(row, cont_col)
        if approvals >= 1:
            name = (row.get(name_col) or "").strip()
            if name:
                out.append(name)
    return out


def main():
    if len(sys.argv) < 2:
        raise SystemExit("사용: python scripts/verify_h1b_sponsors.py /path/to/h1b_datahub.csv")
    with open(sys.argv[1], newline="", encoding="utf-8", errors="replace") as f:
        employers = parse_approved_employers(f)

    with open(REGISTRY_PATH, encoding="utf-8") as f:
        data = json.load(f)
    cos = {k: v for k, v in data.items() if not k.startswith("_")}

    emp_index: dict[str, str] = {}
    for e in employers:
        emp_index.setdefault(normalize(e), e)

    hits = []
    for name, info in cos.items():
        matched = None
        for brand in {name, info.get("token", "")}:
            for e in emp_index.values():
                if match_company(brand, e):
                    matched = e
                    break
            if matched:
                break
        if matched:
            hits.append((name, info.get("ats"), matched, info.get("h1b_sponsor") is True))

    print(f"=== H-1B 매칭 후보: {len(hits)}/{len(cos)} (검토 후 companies.json 반영) ===")
    for name, ats, emp, already in sorted(hits):
        flag = " [이미 플래그됨]" if already else ""
        print(f"  {name:<16} [{ats}] -> {emp}{flag}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: 통과 확인** — `cd ai && uv run --extra dev python -m pytest tests/test_verify_h1b_sponsors.py -v` → pass. ruff: `cd ai && uv run ruff check scripts/verify_h1b_sponsors.py` → clean. (`match_company`/`normalize`는 둘 다 main()에서 사용되므로 noqa 불필요 — 불필요한 noqa는 RUF100을 유발하니 넣지 말 것.)

> 스크립트를 직접 실행하지 말 것(운영 단계는 Task 6). `import verify_uk_sponsors`는 `scripts/`가 sys.path에 있어야 하며, `python scripts/verify_h1b_sponsors.py` 실행 시 스크립트 디렉터리가 sys.path[0]이라 동작한다. 테스트는 sys.path에 scripts를 추가한다.

- [ ] **Step 5: 커밋**

```bash
git add ai/scripts/verify_h1b_sponsors.py ai/tests/test_verify_h1b_sponsors.py
git commit -m "feat(scripts): USCIS H-1B Employer Data Hub 검증 도구(승인이력 필터)"
```

---

### Task 6: 검증 실행 → 플래그 반영 + 가드 테스트 (운영, 사람 검토)

USCIS CSV가 필요하다. USCIS는 자동 다운로드를 403 차단할 수 있으므로, 수동 다운로드한 CSV 경로로 실행한다.

**Files:**
- Modify: `ai/dev_jobs_core/data/companies.json` (`h1b_sponsor: true`)
- Modify: `ai/tests/test_companies_registry.py` (bool 가드)

- [ ] **Step 1: CSV 확보 + 검증 실행 (운영)**

USCIS H-1B Employer Data Hub(https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub)에서 최신 회계연도 CSV를 다운로드(자동 다운로드 403 시 수동). 그 후:

Run: `cd ai && uv run python scripts/verify_h1b_sponsors.py /path/to/h1b_datahub.csv`
승인 이력 있는 회사 매칭 후보를 출력한다.

- [ ] **Step 2: 후보 검토 → 오탐 제거**

UK 때와 동일하게 동음이의어 오탐(예: 다른 업종 동명 회사)을 사람이 제거하고, 매칭 고용주명이 우리 회사의 실제 미국 법인으로 합당한 것만 채택. (databricks/stripe/snowflake/figma 등 대형 빅테크는 거의 확실.)

- [ ] **Step 3: companies.json에 플래그 반영**

채택 회사 항목에 `"h1b_sponsor": true` 추가(ats/token/tags/uk_sponsor 변경 금지, `_meta` 불변). 예:
```json
"databricks": {"ats": "greenhouse", "token": "databricks", "tags": ["data", "ai"], "uk_sponsor": true, "h1b_sponsor": true},
```

- [ ] **Step 4: 가드 테스트 확장** — `ai/tests/test_companies_registry.py`에 추가:

```python
def test_h1b_sponsor_flag_is_bool_when_present():
    data = _load()
    for name, info in data.items():
        if name.startswith("_"):
            continue
        if "h1b_sponsor" in info:
            assert isinstance(info["h1b_sponsor"], bool), f"{name}: h1b_sponsor not bool"
```

- [ ] **Step 5: 검증 + 커밋**

```bash
cd ai && uv run --extra dev python -m pytest tests/test_companies_registry.py -v   # pass
cd ai && uv run python -c "from dev_jobs_core.registry import h1b_sponsor_slugs; print('h1b_sponsor 회사:', len(h1b_sponsor_slugs()))"
git add ai/dev_jobs_core/data/companies.json ai/tests/test_companies_registry.py
git commit -m "feat(registry): 검증된 H-1B 스폰서 회사에 h1b_sponsor 플래그 + bool 가드"
```

> CSV 미확보 시: 코드·테스트(Task 1~5)는 모두 머지 가능하고, 플래그 반영(Task 6)만 CSV 확보 후로 미룰 수 있다. 플래그가 0개여도 기능은 무해(전환 0건). 이 경우 Task 6은 "플래그 반영 보류" 상태로 두고 사람이 CSV 확보 후 실행.

---

### Task 7: 전체 테스트 + 최종 확인

- [ ] **Step 1: 전체 단위 테스트**

Run: `cd ai && uv run --extra dev python -m pytest tests/ -q`
Expected: 전부 PASS(신규 test_us_location/test_registry_h1b_sponsor/test_match_h1b_register/test_verify_h1b_sponsors + 확장 test_companies_registry 포함, 기존 무회귀).

- [ ] **Step 2: 신규 파일 ruff**

Run: `cd ai && uv run ruff check dev_jobs_core/analyzers/us_location.py app/etl/visa_reclassify.py scripts/verify_h1b_sponsors.py`
Expected: clean.

- [ ] **Step 3: 커밋 요약**

Run: `git log --oneline origin/main..HEAD`
Expected: Task 1~6 커밋(스펙/플랜 docs 포함). 운영 실행(Task6 Step1)은 커밋 없음.

> 라이브 reclassify 실행으로 실제 전환 건수(`by_h1b_register`)를 확인하는 것은 머지+CSV확보+ETL 단계에서 수행한다.

---

## Self-Review

- **Spec coverage:** §4.1 플래그 → Task 6. §4.2 h1b_sponsor_slugs → Task 2. §4.3 is_us_location → Task 1. §4.4 match_h1b_register+배선 → Task 3·4. §4.5 검증 스크립트 → Task 5·6. §4.6 가드 → Task 6. §5 엣지/§6 테스트 → 각 Task. 누락 없음. (fetch_unclear_jobs는 UK 레버에서 이미 location/is_remote 반환 → 신규 DB Task 불요.)
- **Placeholder scan:** TBD/TODO 없음. Task 6 후보 회사는 운영 검증 게이트. 모든 코드 스텝에 실제 코드.
- **Type consistency:** `match_h1b_register(jobs: list[dict], h1b_slugs: set[str]) -> dict[str, tuple[str, list[str]]]` Task 3 정의=Task 4 호출. `is_us_location(location, is_remote=False) -> bool` Task 1=Task 3 호출. `h1b_sponsor_slugs() -> set[str]` Task 2=Task 4. `H1B_EVIDENCE` 상수 Task 3 정의·테스트·Task 4 동일. 검증 스크립트 `parse_approved_employers(fp)`/`match_company`/`normalize` Task 5 정의=테스트 사용. reclassify dict 키(company_slug/location/is_remote) 기존 fetch_unclear_jobs 반환과 일치.
- **Ruff F401 주의:** Task 3에서 `h1b_sponsor_slugs` import는 미사용이라 Task 4에서 추가(UK 선례와 동일). Task 5의 `normalize` re-export는 noqa로 유지(테스트가 `v.normalize` 사용).
