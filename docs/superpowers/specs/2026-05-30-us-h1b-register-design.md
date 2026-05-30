# US H-1B 스폰서 대조 — unclear→sponsors 사실 기반 전환 설계

> 작성일 2026-05-30. unclear 감소 로드맵의 레버 4. [[uk-sponsor-register-feature]](레버 1)의 미국판 미러. [[sponsor-first-ordering-feature]]·[[coverage-personio-expansion-feature]] 연결.

## 1. 배경과 목표

UK 레지스터 레버(레버 1)가 직전 ETL에서 116건을 sponsors로 전환하며 외부 사실 대조 방식의 효과를 입증했다. 같은 패턴을 미국에 적용한다. 우리 공고 풀에는 미국 소재 공고가 많고(remoteok 등), databricks·stripe·snowflake 같은 빅테크는 모두 상습 H-1B 스폰서다.

미국 USCIS는 **H-1B Employer Data Hub**를 공개한다 — 회계연도별로 H-1B 청원을 제출한 고용주와 승인/거절 건수를 담은 다운로드 가능한 CSV(FY2009~현재). "승인 이력이 있는 회사"는 실제로 H-1B를 스폰서한다는 강한 사실이다.

**목표:** USCIS 데이터에 승인 이력이 있는 회사의 **미국 소재** unclear 공고를 `sponsors`로 사실 기반 전환. 기존 공고에 reclassify로 소급. 정밀 우선.

**비목표:** worksite 단위 정밀 매칭(DoL LCA), 자동 CSV 동기화, 잡보드 자유텍스트 회사, OPT/그린카드 등 타 비자.

## 2. 핵심 결정 (브레인스토밍 확정, UK 레버 미러)

1. **데이터소스 = USCIS H-1B Employer Data Hub** (회사단위 집계 CSV: 고용주명+승인/거절+city/state+NAICS). DoL LCA(건별·worksite 포함이나 파일 거대) 대신 채택.
2. **매칭 = 큐레이션 플래그(정밀 우선).** CSV는 런타임 미적재. 오프라인 검증 스크립트가 우리 레지스트리 회사를 데이터 허브와 정밀 매칭해 **승인 이력(approvals ≥1)** 있는 회사만 후보로 출력 → 사람 검토 → `companies.json`의 `h1b_sponsor: true` 커밋. 잡보드 자유텍스트 회사 미커버.
3. **위치 게이팅 = 미국 소재만(보수적).** 플래그 회사라도 공고 `location`이 US 신호를 가질 때만 전환. EU/UK/모호한 remote는 unclear 유지.
4. **표기 = 기존 `sponsors` 재사용 + 투명한 evidence.** 별도 티어 없음. UK 레버와 동일 패턴.

## 3. 아키텍처 / 데이터 흐름 (UK 레버 미러)

```
[오프라인, 가끔]  ai/scripts/verify_h1b_sponsors.py
  USCIS Employer Data Hub CSV(수동 다운로드, 경로 인자) 로드
  → 레지스트리 회사와 정밀 정규화 매칭 + 승인이력(initial+continuing approvals ≥1) 필터
  → 후보(매칭 고용주명 동봉) 출력 → 사람 검토 → companies.json "h1b_sponsor": true 수동 커밋

[런타임, 매 ETL 사이클]  reclassify_unclear_visa
  keyword → UK 레지스터 → ★H-1B 매칭(신규)★ → LLM → 회사추론
       │ unclear 공고마다:
       │   company_slug ∈ h1b_sponsor_slugs()  (레지스트리)
       │   AND is_us_location(location, is_remote)  (신규 analyzer)
       │   → ("sponsors", ["회사가 미국 H-1B 스폰서 이력 보유 (USCIS Employer Data Hub)"])
```

H-1B 단계는 **UK 단계 바로 뒤, LLM 앞**. 무료·사실 기반이라 LLM 앞에서 비용 절감. UK·H-1B 둘 다 해당 회사는 UK가 먼저 잡으면 H-1B는 자연 스킵(이미 results에 있고 remaining에서 빠짐) — 중복 없음, evidence는 먼저 매칭된 쪽.

`fetch_unclear_jobs`는 이미 `location, is_remote` 반환(UK 레버에서 추가됨) → DB 변경 없음.

## 4. 컴포넌트 상세 (UK와 1:1 대응)

### 4.1 `companies.json` — `"h1b_sponsor": true` 플래그 (검증 통과 회사)
### 4.2 `registry.py` — `h1b_sponsor_slugs() -> set[str]` (uk_sponsor_slugs 패턴 동일, `h1b_sponsor is True` 토큰 집합)
### 4.3 `analyzers/us_location.py` — 신규 (순수 함수)
`is_us_location(location: str | None, is_remote: bool = False) -> bool`.
- **강한 신호**(단독 인정): `United States`, `USA`, `U\.S\.`, 단어경계 `US`, "Remote (US/USA/United States)", 전체 주 이름(California, New York, Texas, Washington, Massachusetts, Illinois, Colorado, Georgia, Florida …), 주요 도시(San Francisco, New York, Seattle, Austin, Boston, Chicago, Los Angeles, Denver, Atlanta, Mountain View, Palo Alto …).
- **2글자 주 약어는 `, XX` 패턴에서만**: 정규식 `,\s*(AL|AK|AZ|...|WY)\b`(50개 주 + DC). 이로써 "Austin, TX"는 잡고 "or"/"working in"/"me"/"ok" 단어 오탐은 막는다.
- EU/UK/모호한 remote("Remote", "Remote - Europe")/None → False. 보수적.
### 4.4 `visa_reclassify.py` — `match_h1b_register(jobs, slugs)` 순수 함수 + reclassify에 UK 단계 직후 삽입 + `by_h1b_register` 통계. `H1B_EVIDENCE` 상수.
### 4.5 `scripts/verify_h1b_sponsors.py` — 오프라인 도구. CSV 경로 인자 필수(USCIS 자동 다운로드는 403 차단 가능 → 자동 시도 실패 시 수동 다운로드 안내). `normalize`/`match_company`는 UK 스크립트와 동일 정밀 매칭. 추가: 승인이력 컬럼(Initial Approvals + Continuing Approvals) 합 ≥1 인 고용주만 후보.
### 4.6 가드 테스트 — `h1b_sponsor` 존재 시 bool 검증 추가.

## 5. 에러 처리 / 엣지

- 플래그 없는/자유텍스트 회사: 안 건드림.
- location NULL/빈: False.
- 이미 sponsors/no_sponsor: reclassify가 unclear만 조회 → 덮어쓰지 않음.
- UK·H-1B 중복 회사: 순서상 UK 먼저, H-1B는 remaining에서 빠져 자연 스킵.
- 검증 스크립트 CSV 미제공/포맷 불일치: 명확히 에러 출력 후 종료. 런타임 무영향.

## 6. 테스트 (전부 네트워크·DB 없음)

- `is_us_location`: 강신호(USA/주이름/주요도시/"Remote (US)")→True; `, TX`/`, CA`→True; "or"/"working in"/"me"/Berlin/London/None/모호한 remote→False. **주 약어 오탐 케이스 집중**.
- `h1b_sponsor_slugs()`: 플래그 true만, 키 없으면 제외.
- `match_h1b_register`: 플래그회사+US위치→sponsors(+evidence) / 플래그회사+Berlin→스킵 / 비플래그회사+US위치→스킵.
- 검증 스크립트 `normalize`/`match_company`(UK 동일) + 승인이력 필터(approvals≥1만 후보, 0이면 제외) 단위 테스트.
- 가드 테스트: `h1b_sponsor` bool.

## 7. 범위 밖 (YAGNI)

- DoL LCA worksite 단위 매칭.
- 자동 CSV 동기화.
- 잡보드 자유텍스트 회사 매칭.
- OPT/그린카드 등 타 비자 신호.

## 8. 기대 효과

US 소재 unclear 공고 중 H-1B 승인 이력 회사 건이 sponsors로 전환. UK 레버(116)와 합쳐 미국 빅테크(databricks/stripe/snowflake 등) 공고의 큰 unclear 풀 공략 → unclear 추가 감소, 스폰서 풀 증가(스폰서 우선 정렬 시너지). 정확 건수는 머지+검증(수동 CSV)+ETL 후 `by_h1b_register` 통계로 확정.
