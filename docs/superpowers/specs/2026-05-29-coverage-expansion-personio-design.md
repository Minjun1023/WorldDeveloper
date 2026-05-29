# 공고 수 확대 — Personio 커넥터 + EU/스폰서 회사 추가 설계

> 작성일 2026-05-29. 스폰서 우선 정렬([[sponsor-first-ordering-feature]], PR #13) 이후 후속 작업. 목표는 신뢰도를 유지하면서 활성 공고 수와 스폰서 풀을 동시에 늘리는 것.

## 1. 배경과 목표

현재 활성 공고는 약 1,961개(unclear 1,628 / sponsors 237 / no_sponsor 96). 소스는 회사별 ATS 커넥터(greenhouse/lever/ashby/smartrecruiters, `companies.json` 122개사)와 애그리게이터(remoteok/arbeitnow/wwr)다. 가장 신뢰도 높고 사기 위험이 없는 확대 레버는 **검증된 회사를 늘리는 것**이며, 그중 유럽 시장 커버리지를 끌어올리려면 독일·EU에서 압도적으로 많이 쓰이는 Personio ATS 지원이 필요하다.

**목표:**
- 신규 Personio 커넥터 1개 추가(코드).
- `companies.json`에 라이브 검증된 Personio 회사 + EU/스폰서 친화 greenhouse/ashby 회사를 추가.
- 스폰서 풀이 함께 커지도록 EU 가중치를 둔다(스폰서 우선 정렬과 시너지).
- "신뢰도 우선" 원칙 유지: 검증 못 한 토큰은 제외, 필터 완화 금지, Adzuna 비활성 유지.

**기대 효과(추정):** 약 35~65개 신규 회사 × 회사당 평균 약 15개 개발 공고 = 활성 공고 +500~1,000개(1,961 → 약 2,400~3,000), 스폰서 풀도 EU 가중으로 증가.

비목표: 공고 절대 수를 위해 필터를 느슨하게 하거나 비개발 직군을 들이지 않는다.

## 2. Personio 공개 피드 (검증된 사실)

Personio는 회사별 공개 XML 피드를 제공한다(키 불필요):

```
https://{token}.jobs.personio.com/xml
```

루트는 `<workzag-jobs>`, 자식은 `<position>` 반복. 라이브로 확인한 실제 필드(2026-05-29, `personio.jobs.personio.com/xml`):

```xml
<workzag-jobs>
  <position>
    <id>1834171</id>
    <subcompany>Personio SE &amp; Co. KG</subcompany>
    <office>Munich</office>
    <additionalOffices><office>Berlin</office></additionalOffices>
    <department>Product and Tech</department>
    <recruitingCategory>Engineering</recruitingCategory>
    <name>Staff Software Engineer, Data Platform</name>
    <jobDescriptions></jobDescriptions>
    <employmentType>permanent</employmentType>
    <seniority>experienced</seniority>
    <schedule>full-time</schedule>
    <occupation>software_and_web_development</occupation>
    <occupationCategory>it_software</occupationCategory>
    <createdAt>2024-11-13T14:10:41+00:00</createdAt>
  </position>
</workzag-jobs>
```

공고 본문이 있는 회사는 `<jobDescriptions>` 안에 `<jobDescription><name>…</name><value><![CDATA[…]]></value></jobDescription>` 블록이 반복된다(위 예시는 비어 있음).

**중요한 운영 제약(라이브 확인됨):** 존재하지 않거나 비활성인 서브도메인은 `307`로 `personio.com`에 리다이렉트되고, 빠르게 여러 번 조회하면 `429`(rate limit)가 난다. 따라서 `{회사명}.jobs.personio.com` 이 동작한다고 가정할 수 없으며, **회사마다 토큰을 개별 검증해야 한다.** 이 사실이 아래 4단계(라이브 검증)를 필수로 만든다.

## 3. 아키텍처 / 데이터 흐름

기존 ATS 커넥터 패턴을 그대로 따른다(예: `smartrecruiters.py`). 변경은 ETL(`ai/`)에 한정한다.

```
companies.json (ats:"personio", token:"<subdomain>")
        │  registry.list_all()
        ▼
app/etl/jobs.py  ── ATS_FETCHERS["personio"] = personio.fetch ──▶ personio.fetch(token, limit)
        │                                                              │ httpx GET {token}.jobs.personio.com/xml
        │                                                              ▼ _parse_positions(xml_text) → list[dict]
        │                                                              ▼ _to_posting(token, pos) → JobPosting
        ▼
기존 파이프라인(dev 필터 → 비자 분석 → dedup → upsert) 변경 없음
```

### 3.1 커넥터: `ai/dev_jobs_core/sources/personio.py`

`smartrecruiters.py`와 동일한 시그니처/분해. 네트워크 없이 테스트 가능하도록 순수 함수로 쪼갠다. XML 파싱은 표준 라이브러리 `xml.etree.ElementTree` 사용(신규 의존성 없음).

- `_parse_positions(xml_text: str) -> list[dict]` — `<workzag-jobs>/<position>`를 dict 리스트로. 파싱 실패/빈 입력 → `[]`.
- `_location(pos: dict) -> str` — `office` + `additionalOffices/office`들을 합쳐 콤마 결합.
- `_description(pos: dict) -> str` — `jobDescriptions/jobDescription`의 `value` 텍스트들을 개행으로 결합(없으면 "").
- `_to_posting(token: str, pos: dict) -> JobPosting | None` — `id` 없으면 `None`. 매핑:
  - `job_id = f"personio:{token}:{id}"`, `source = "personio"`
  - `title = name`, `company = subcompany or token`
  - `location = _location(pos)`, `is_remote = False`(피드에 명시 원격 플래그 없음; office 기반)
  - `employment_type = employmentType`
  - `description = _description(pos)`
  - `apply_url = f"https://{token}.jobs.personio.com/job/{id}"`
  - `posted_at = createdAt`
- `async def fetch(token: str, limit: int = 20) -> list[JobPosting]` — `httpx.AsyncClient(timeout=30, headers={"User-Agent": "dev-jobs/0.1"})`로 `https://{token}.jobs.personio.com/xml` GET, `raise_for_status()`, `_parse_positions(...)[:limit]`을 `_to_posting`으로 변환해 `None` 제외 반환. 개별 네트워크 예외는 상위 ETL 루프가 회사 단위로 잡는 기존 동작에 맡긴다(커넥터는 smartrecruiters처럼 상세 예외만 내부 흡수, 목록 호출 실패는 전파).

### 3.2 ETL 등록: `ai/app/etl/jobs.py`

- import 라인에 `personio` 추가:
  `from dev_jobs_core.sources import adzuna, arbeitnow, ashby, greenhouse, lever, personio, remoteok, smartrecruiters, weworkremotely`
- `ATS_FETCHERS`에 `"personio": personio.fetch` 추가.

다른 변경 불필요 — 회사 선택은 `[c for c in registry.list_all() if c.get("ats") in ATS_FETCHERS]`로 자동 포함된다.

### 3.3 회사 추가: `ai/dev_jobs_core/data/companies.json`

4단계 라이브 검증을 통과한 회사만 추가한다. 두 묶음:

- **Personio 회사(`ats: "personio"`)** — 후보: trivago, aboutyou, getyourguide, hellofresh, babbel, celonis, picnic, personio, flixbus, sennder, freenow 등. 검증 통과분만. `token`은 실제로 동작하는 서브도메인.
- **EU/스폰서 친화 greenhouse/ashby 회사** — 후보: adyen, mollie, bunq, traderepublic, klaviyo, datadog, snowflake, cloudflare, mistral, deepl, jetbrains 등. 기존 검증 패턴(커밋 27da484)과 동일하게 200 + 공고 존재 + 개발 공고 통과 확인분만.

모든 신규 EU 회사는 `tags`에 `"europe"`를 포함한다(스폰서 우선/유럽 큐레이션에서 활용). `_meta.last_updated`를 `2026-05-29`로, `_meta.description`의 ATS 목록에 `personio` 추가.

> 후보 수는 검증 결과에 따라 달라진다. 위 목록은 시작점일 뿐, 검증 못 한 토큰은 조용히 제외한다(과잉 포함보다 신뢰도 우선).

## 4. 라이브 검증 절차

회사 추가 전에 반드시 토큰을 개별 검증한다(섹션 2의 제약 때문). 검증은 일회성 스크립트 또는 서브에이전트로 수행하고, 결과는 채팅에 요약한다. 회사를 포함시키는 기준(셋 다 충족):

1. 피드 HTTP `200`(리다이렉트로 `personio.com`/`429`가 되면 제외).
2. 공고(`<position>`) ≥ 1개.
3. `dev_jobs_core/filter.py`의 개발 필터를 통과하는 공고 ≥ 1개.

greenhouse/ashby 후보는 기존 커넥터로 동일 기준(200 + 공고 ≥1 + 개발 통과 ≥1) 확인. Personio rate limit을 피하려고 요청 사이 간격을 두고 순차 조회한다.

검증은 코드가 아니라 운영 단계다. 검증 산출물(포함/제외 목록)은 PR 설명과 메모리에 남긴다.

## 5. 테스트

- **`ai/tests/test_personio.py`** (신규) — `test_smartrecruiters.py` 패턴 그대로. 픽스처 XML 문자열(본문 있는 `<position>` 1개 + `id` 없는 `<position>` 1개)로 네트워크 없이 순수 함수 검증:
  - `_parse_positions`가 position 2개 반환, 빈/깨진 입력은 `[]`.
  - `_to_posting`이 `job_id`/`source`/`title`/`company`/`location`(office+additionalOffices)/`employment_type`/`description`(jobDescription value)/`apply_url`/`posted_at` 정확 매핑.
  - `id` 없는 position은 `None`.
  - `jobDescriptions` 비어 있을 때 `description == ""`.
- **ETL 등록 스모크 테스트** — `app.etl.jobs.ATS_FETCHERS`에 `"personio"`가 있고 `personio.fetch`를 가리키는지 확인(네트워크 없음).
- **`companies.json` 유효성 테스트** — 모든 항목(`_meta` 제외)이 `ats ∈ {greenhouse, lever, ashby, smartrecruiters, personio}` 이고 `token`이 비어있지 않음을 확인. JSON 파싱 성공 확인.

모든 테스트는 네트워크를 타지 않는다(라이브 검증은 4단계의 별도 운영 절차).

## 6. 범위 밖 (YAGNI)

- **MCP 미러(`dev-jobs-mcp/`)** — smartrecruiters 커넥터도 MCP에 미러되지 않은 선례가 있다. MCP는 자체 `companies.json`을 갖고 ETL(`ai/`)이 라이브 DB를 채우는 1차 경로이므로, 이번 작업은 `ai/`에 한정한다. MCP personio 미러/회사 추가는 하지 않는다.
- Workable/Recruitee 등 추가 커넥터.
- 비자 분류 휴리스틱 확장([[visa-classification-llm-feature]]는 그대로).
- `filter.py` 정밀도 추가 튜닝(arbeitnow 비개발 통과 이슈는 별도 후속).
- Adzuna 재활성화(사기 우려로 휴면 유지).
- companies.json 토큰 자동 발견 도구.

## 7. 위험과 완화

- **토큰 오추정** → 동작하지 않는 회사 추가. 완화: 4단계 라이브 검증 필수, 통과분만 포함.
- **Personio rate limit(429)** → 검증 누락. 완화: 순차 조회 + 간격, 실패는 제외(재시도 강제 안 함).
- **비EU/비개발 회사 혼입** → 신뢰도 저하. 완화: 개발 필터 통과 기준 + 기존 ETL의 dev 필터·비자 분석이 2차 방어선.
- **활성 공고 급증으로 ETL 시간 증가** → 회사당 `limit`은 기존 값을 따르며, 커넥터는 목록 1콜(+필요시 본문은 XML 내 포함)로 smartrecruiters보다 가볍다.
