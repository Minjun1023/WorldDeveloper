# ATS 확장 설계 (Workable + SmartRecruiters + 회사 등록)

- 작성일: 2026-05-26
- 브랜치: `feat/ats-expansion` (base origin/main `1b3988e`)
- 상태: 설계 확정 (구현 전)

## 1. 목표와 범위

신뢰도 우선으로 공고 커버리지를 늘린다. 애그리게이터(Adzuna, 사기/유령 공고 우려로 dormant 유지) 대신 **회사 ATS 직접 수집**을 확장한다 — 채용 공고가 회사 자체 채용 시스템에서 직접 오므로 사기 위험이 사실상 없고, 제품 니치(한국 개발자 해외/EU·비자 진출)와 맞는다.

이번 increment (범위 조정 2026-05-26: 라이브 API 확인 결과 Workable 은 유효 계정/응답 형태를 확인하지 못해 후속으로 미룸):
- **신규 무료 ATS 커넥터: SmartRecruiters** (공개 API 검증 완료, 키 불필요).
- **회사 레지스트리 확장**: SmartRecruiters + 기존 ATS(greenhouse/lever/ashby) 를 쓰는 검증된 회사 등록. 토큰은 롤아웃에서 라이브 검증해 0건 회사는 정리.

비범위(후속): **Workable**(라이브 응답 형태 확인 후 동일 패턴으로 추가), Recruitee/Personio 등 추가 ATS, Adzuna 활성화, 회사 자동 디스커버리. 유료 소스 미도입.

## 2. 현재 상태 (기준선)

- 회사 레지스트리 `ai/dev_jobs_core/data/companies.json` = `{회사명: {"ats": .., "token": .., "tags": [..]}}` 딕셔너리(+`_meta`). 현재 53곳, ats ∈ {greenhouse, lever, ashby}. `dev_jobs_core/registry.py list_all()` 이 로드.
- ATS 커넥터: `ai/dev_jobs_core/sources/{greenhouse,lever,ashby}.py`, 시그니처 `async def fetch(token, limit=20) -> list[JobPosting]`.
- ETL `ai/app/etl/jobs.py`: `ATS_FETCHERS = {"greenhouse": .., "lever": .., "ashby": ..}` 로 ats 이름→fetch 매핑. registry 의 `ats in ATS_FETCHERS` 회사들을 동시성 제한 + 회사별 실패 격리로 수집.
- 수집 후 파이프라인(job-coverage 기능, 이미 main): `is_dev_role` 필터 → `dedup`(job_id + 정규화 키 + 소스 우선순위) → transform → upsert. `dedup._SOURCE_PRIORITY` = greenhouse/lever/ashby:3, remoteok/arbeitnow/wwr:2, adzuna:1.
- `JobPosting`(`dev_jobs_core/models.py`): job_id, source, title, company, location, is_remote, employment_type, description, apply_url, posted_at, closes_at, tags, salary_*, visa_status.

## 3. 설계

### A. SmartRecruiters 커넥터 — `ai/dev_jobs_core/sources/smartrecruiters.py`

라이브 API 검증 완료(2026-05-26, 예: 토큰 `Visa`). 기존 ATS 패턴(`async def fetch(token, limit=20) -> list[JobPosting]`) + 순수 파서.

- **목록**: `GET https://api.smartrecruiters.com/v1/companies/{token}/postings?limit={limit}&offset=0` (키 불필요) → `{offset, limit, totalFound, content:[...]}`. content 항목: `id`, `name`(title), `company{identifier,name}`, `releasedDate`(ISO), `location{city,region,country,remote,hybrid,fullLocation}`, `typeOfEmployment{label}`, `ref`(API self-link). **목록에는 설명·사용자 apply URL 이 없음.**
- **상세**(설명·apply URL 보강, 공고당 1콜): `GET https://api.smartrecruiters.com/v1/companies/{token}/postings/{id}` → `applyUrl`, `postingUrl`, `jobAd.sections.{companyDescription,jobDescription,qualifications,additionalInformation}.{title,text}`(HTML). 설명 = `jobAd.sections.jobDescription.text` (+ qualifications.text 이어붙이기), apply_url = `applyUrl`(없으면 `postingUrl`, 그것도 없으면 `https://jobs.smartrecruiters.com/{token}/{id}`).
- 구조: 순수 `_parse_list(payload) -> list[dict]`(목록 raw item) + 순수 `_to_posting(token, item, detail) -> JobPosting`(목록+상세 → JobPosting) + `async def fetch(token, limit=20)`(목록 1콜 → 각 posting 상세 1콜 → `_to_posting`). 상세 호출 실패한 posting 은 설명 없이 목록 필드로 채움(graceful).
- 매핑: `job_id=f"smartrecruiters:{token}:{id}"`, `source="smartrecruiters"`, title=name, company=company.name, location=location.fullLocation(또는 city/country 조합), is_remote=location.remote, employment_type=typeOfEmployment.label, posted_at=releasedDate.
- 누락/None 필드는 안전 처리(`(item.get('location') or {}).get(...)` 패턴).

> Workable 은 이번 범위에서 제외(라이브 응답 형태 미확인). 추후 유효 계정으로 형태 확인 후 동일 패턴으로 추가.

### B. 회사 레지스트리 확장 (`companies.json`)
- **SmartRecruiters 회사**(`"ats": "smartrecruiters"`) + 추가로 **기존 ATS(greenhouse/lever/ashby)** 를 쓰는 잘 알려진 EU/글로벌 테크 회사를 등록. 형식: `"name": {"ats": "smartrecruiters", "token": "...", "tags": ["europe", ...]}`. 비자 스폰서 많은 EU 중견 + 글로벌 대형 위주.
- SmartRecruiters 토큰은 회사 식별자(대소문자 구분, 예: `Visa`)이며 회사마다 공개 공고 유무가 다름. **검증은 롤아웃에서**: ETL 실행 후 공고 0건 회사는 제거/교체. 실패 격리 덕에 잘못된 토큰이 전체 사이클을 막지 않는다. (확실히 동작하는 시드 1곳 이상 = `Visa` 부터 시작.)

### C. 통합 (기존 파이프라인 재사용)
- `ai/app/etl/jobs.py`: import 에 `smartrecruiters` 추가, `ATS_FETCHERS` 에 `"smartrecruiters": smartrecruiters.fetch` 추가. (registry 의 해당 회사들이 자동으로 ATS 루프에 포함 — 기존 동시성/실패격리 그대로.)
- `ai/dev_jobs_core/dedup.py`: `_SOURCE_PRIORITY` 에 `"smartrecruiters": 3` 추가(ATS = 최고 신뢰도).
- `is_dev_role` 필터·`dedup` 은 수집 후 일괄 적용되므로 신규 ATS 공고에 자동 반영(추가 배선 불필요).

### D. 테스트 + 롤아웃
- pytest(`ai/tests/`): `smartrecruiters._parse_list`/`_to_posting`(샘플 목록+상세 페이로드 → JobPosting 매핑, 누락 필드 안전, apply_url 폴백), `dedup` 에 `smartrecruiters` 우선순위 반영 확인(smartrecruiters vs adzuna 같은 공고 → smartrecruiters 채택).
- 롤아웃(라이브, 키 불필요): ETL 1회 실행 → `SELECT source, count(*) FROM jobs WHERE is_active GROUP BY source` 로 `smartrecruiters` 등장·활성 공고 증가 측정 → 공고 0건 회사 토큰 정리.

## 4. 영향받는 파일 (요약)
- 신규: `ai/dev_jobs_core/sources/smartrecruiters.py`, 그 테스트.
- 변경: `ai/dev_jobs_core/data/companies.json`(회사 추가), `ai/app/etl/jobs.py`(ATS_FETCHERS 에 smartrecruiters), `ai/dev_jobs_core/dedup.py`(_SOURCE_PRIORITY 에 smartrecruiters:3).
- 재사용(변경 없음): registry.py, filter.py, transform/upsert, 기존 ATS 커넥터.
- 후속(이번 제외): `workable.py`.
