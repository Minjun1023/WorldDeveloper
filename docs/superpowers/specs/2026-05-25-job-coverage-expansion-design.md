# 공고 커버리지 확대 설계 (무료 집계 소스 중심)

- 작성일: 2026-05-25
- 브랜치: `feat/job-coverage-adzuna` (base: origin/main `e04a522`)
- 상태: 설계 확정 (구현 전)

## 1. 목표와 범위

현재 활성 공고가 491개(DB 520개)뿐이라 커버리지가 빈약하다. **무료 소스만으로** 주요 해외(EU/미국/영국/캐나다 등) 개발 직무 공고를 대폭 늘린다. API 비용 0을 유지한다(임베딩은 로컬 모델, 적재는 룰베이스라 공고 수가 늘어도 비용 없음).

방향: 지역을 넓히되 **비자·관련성은 하드 차단이 아니라 필터·신호로 유지** — 개발 직무만 남기고, 비자 여부는 기존대로 표시(`unclear` 포함). "한국 개발자 해외 진출" 이라는 제품 축은 유지.

이번 increment(접근 1):
- **Adzuna**(무료 집계 API, 국가별) 를 핵심 신규 소스로 도입.
- **WeWorkRemotely**(무료 RSS) 원격 보드 추가.
- **개발 직무 필터** + **크로스소스 중복제거** 도입(집계 노이즈 대응).

비범위(후속): 신규 ATS 커넥터(Workable/SmartRecruiters/Recruitee 등)·회사 대량 등록(접근 2), 유료 JSearch/RapidAPI, 비자 추출 고도화.

## 2. 현재 상태 (기준선)

- ETL `ai/app/etl/jobs.py`의 `run_full_cycle()` 가 스케줄러(`ai/app/etl/scheduler.py`)로 주기 실행: ① 잡보드(remoteok, arbeitnow) 병렬 fetch, ② 등록 회사 ATS(greenhouse/lever/ashby) fetch → ③ `job_id` 완전일치 dedup → ④ `transform()`(비자/salary/임베딩) → ⑤ Postgres upsert → ⑥ stale/expired 비활성화.
- 소스 커넥터: `ai/dev_jobs_core/sources/<name>.py`, 시그니처 `async def fetch(query="", limit=50, max_pages=3) -> list[JobPosting]`. httpx 사용, API 응답 → `JobPosting` 매핑.
- `JobPosting`(`ai/dev_jobs_core/models.py`): `job_id="{source}:{native_id}"`, `source`, `title`, `company`, `location`, `is_remote`, `employment_type`, `description`, `apply_url`, `posted_at`, `closes_at`, `tags`, `salary_*`, `visa_status`(기본 `unclear`).
- 모든 기존 소스는 키 불필요 무료. 임베딩 = 로컬 `paraphrase-multilingual-MiniLM-L12-v2`(sentence-transformers).
- **현재 dedup 한계**: `unique = {p.job_id: p for p in postings}` — `job_id` 완전일치만. 같은 공고가 다른 소스에서 오면(다른 job_id) 중복 제거 안 됨. 집계 소스 도입 시 이 부분이 문제가 되므로 본 설계에서 보강.

## 3. 설계

### A. 신규 무료 소스

#### A-1. Adzuna 커넥터 — `ai/dev_jobs_core/sources/adzuna.py`
- Adzuna API: `GET https://api.adzuna.com/v1/api/jobs/{country}/search/{page}` (params: `app_id`, `app_key`, `what`(검색어), `category=it-jobs`, `results_per_page`, `max_days_old`).
- 무료 등록으로 `app_id`/`app_key` 발급. `is_enabled()` — 키 없으면 빈 리스트 반환(기존 jsearch 패턴), 나머지 소스는 정상.
- **국가 순회**(설정값): 기본 `us, gb, de, nl, ca, fr, ie, au, sg`. 국가별 `results_per_page`(최대 50)·페이지 수 제한으로 무료 티어 rate limit 준수.
- 매핑: `JobPosting(job_id="adzuna:{country}:{id}", source="adzuna", title, company=company.display_name, location=location.display_name, is_remote=(키워드/위치로 추정), employment_type=contract_type 매핑, description, apply_url=redirect_url, posted_at=created, salary_min/max=salary_min/max(있으면))`.
- 시그니처: `async def fetch(countries: list[str], query: str = "", per_country: int = 50, max_pages: int = 1, max_days_old: int = 45) -> list[JobPosting]`. (ETL이 config의 countries/limit을 주입.)

#### A-2. WeWorkRemotely 커넥터 — `ai/dev_jobs_core/sources/weworkremotely.py`
- WWR 프로그래밍 카테고리 RSS(무료·키 불필요): `https://weworkremotely.com/categories/remote-programming-jobs.rss`.
- 매핑: `JobPosting(job_id="wwr:{guid}", source="wwr", title, company, location="Remote", is_remote=True, description, apply_url=link, posted_at=pubDate)`.
- 시그니처: 기존 보드 패턴과 동일 `async def fetch(query: str = "", limit: int = 100) -> list[JobPosting]`.

### B. 품질 — 개발 직무 필터 + 크로스소스 중복제거

#### B-1. 개발 직무 필터 — `ai/dev_jobs_core/filter.py`
- `is_dev_role(title: str, tags: list[str], description: str = "") -> bool`.
- 허용(포함 시 통과): engineer, developer, programmer, swe, software, backend, frontend, full[- ]?stack, mobile, ios, android, data engineer, machine learning, ml, ai, devops, sre, platform, infrastructure, security engineer, qa engineer, embedded 등.
- 제외(우선 차단): sales, marketing, recruiter, hr, account manager, customer success, finance, designer(비엔지니어), product manager(논쟁 → 기본 제외), content, copywriter 등.
- 판정 순서: ① title에 제외 키워드 매칭 → drop. ② title/tags에 허용 키워드 매칭 → keep. ③ 둘 다 아니면(애매) → keep(재현율 우선 — 개발 공고 누락보다 약간의 노이즈를 허용). description 은 보조 신호로만 사용.
- 적용 범위: 집계·보드 소스(adzuna, remoteok, arbeitnow, wwr)에 적용. ATS(greenhouse/lever/ashby)는 큐레이션 회사라 기본 통과시키되, 동일 필터를 일괄 적용해도 무해(개발 회사 위주).

#### B-2. 크로스소스 중복제거 — `ai/dev_jobs_core/dedup.py`
- `dedup(postings: list[JobPosting]) -> list[JobPosting]`.
- 1차: 기존 `job_id` 완전일치(유지).
- 2차(신규): 정규화 키로 유사 공고 병합. 키 후보 = `normalize(company) + "|" + normalize(title) + "|" + normalize(location_country)`. `normalize` = 소문자, 공백/특수문자 정리, 회사 접미사(Inc/GmbH/Ltd) 제거. (보조: `apply_url`의 호스트+경로 정규화로 동일 URL 탐지.)
- **소스 우선순위**로 대표 선택: `ats(greenhouse/lever/ashby) > native board(remoteok/arbeitnow/wwr) > aggregator(adzuna)`. 같은 키면 우선순위 높은 소스의 공고를 채택(비자/회사 신호가 더 좋음).

### C. ETL 배선 + 설정

- `run_full_cycle()` 수정:
  - 보드 fetch 단계에 `weworkremotely.fetch` 추가(기존 boards dict).
  - **Adzuna 전용 단계** 추가(다국가라 별도, 실패 격리): `is_enabled()`면 config의 countries/per_country로 `adzuna.fetch(...)` 호출, 결과 합산. 키 없으면 skip.
  - dedup 전에 **개발 직무 필터** 적용, 기존 exact dedup 자리를 **`dedup()`(exact+fuzzy)** 로 교체.
  - `fetch_stats`에 소스별 수·필터 제거 수·dedup 병합 수 기록(측정용).
- 설정 `ai/app/config.py`(settings): `adzuna_app_id`, `adzuna_app_key`, `adzuna_countries`(콤마 구분, 기본값 위 9개), `adzuna_per_country`(기본 50), `adzuna_max_pages`(기본 1). 모두 env 오버라이드.
- `.env`/`.env.example`(루트) + `ai` 환경 문서: `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `ADZUNA_COUNTRIES`. 키 미설정 시 Adzuna만 비활성.

### D. 테스트 + 롤아웃

- pytest(`ai/tests/`):
  - `adzuna.fetch`: httpx mock 응답 → JobPosting 매핑·국가순회·키 없을 때 빈 리스트.
  - `weworkremotely.fetch`: RSS mock → 매핑.
  - `is_dev_role`: 허용/제외 케이스(엔지니어 keep, 세일즈/리크루터 drop).
  - `dedup`: 동일 공고 다중소스 → 1건, 우선순위 높은 소스 채택; 서로 다른 공고 보존.
  - ETL: 한 소스 예외 시 나머지 진행(실패 격리), 통계 필드 존재.
- 롤아웃: Adzuna 키 발급 → ETL 1회 실행 → 측정(신규 active 수·소스별 분포·필터 제거율·dedup 병합율) → countries/limit 튜닝. 목표: 수천 단위 활성 공고.

## 4. 컴플라이언스 / 한도

- **Adzuna 무료 티어**: 등록 필요(app_id/app_key), rate limit 존재 + 결과에 Adzuna 출처 표기(attribution) 의무 가능 → 구현 전 현재 ToS 확인해 호출 빈도·표기 반영. 무료 티어 초과 호출 방지를 위해 국가×페이지 수를 보수적으로 시작.
- 임베딩 로컬·적재 룰베이스라 공고 수 증가에 따른 API 비용 없음.

## 5. 영향받는 파일 (요약)

- 신규: `ai/dev_jobs_core/sources/adzuna.py`, `ai/dev_jobs_core/sources/weworkremotely.py`, `ai/dev_jobs_core/filter.py`, `ai/dev_jobs_core/dedup.py`, 각 테스트.
- 변경: `ai/app/etl/jobs.py`(소스 배선 + 필터 + dedup 교체 + 통계), `ai/app/config.py`(Adzuna 설정), `.env.example`(루트).
- 기존 dedup(`{p.job_id: p}`)은 `dedup()` 호출로 대체.
