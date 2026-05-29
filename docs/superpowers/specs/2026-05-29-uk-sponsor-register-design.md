# UK 스폰서 라이선스 레지스터 대조 — unclear→sponsors 사실 기반 전환 설계

> 작성일 2026-05-29. unclear 감소 로드맵의 ★레버 1. [[coverage-personio-expansion-feature]](레버 3) 이후. [[sponsor-first-ordering-feature]]·[[visa-classification-llm-feature]]와 연결.

## 1. 배경과 목표

활성 공고 비자 분포는 unclear가 83%(~1,628/1,961)다. 대부분 공고가 본문에 비자 스폰서 여부를 **아예 안 적기 때문**이라, 텍스트 파싱(키워드·LLM)으로는 더 못 줄인다. 침묵하는 unclear를 줄이는 유일한 방법은 **외부 사실 대조**다.

영국 내무부(Home Office)는 워커 비자 스폰서 라이선스를 보유한 조직 전체를 공개 CSV로 발행한다("Register of licensed sponsors: workers", 매일 갱신, ~141k 조직). 우리 레지스트리 회사 142곳 중 **~75-83곳이 이 명부에 등재된 UK 라이선스 스폰서**임을 실측 확인했다(Monzo Bank, Revolut, Wise, GoCardless, Stripe UK, Adyen London, Mollie, Cloudflare, MongoDB UK, Datadog, OpenAI UK, Anthropic, DeepL UK, Celonis, SumUp, Synthesia 등).

**목표:** 명부에 등재된 회사의 **UK 소재** unclear 공고를 `sponsors`로 사실 기반 전환. 기존 공고에 즉시 소급 적용. 정밀(오탐 0) 우선.

**비목표:** 잡보드 자유텍스트 회사 매칭, 별도 비자 티어 신설, 명부 자동 일일 동기화, US/EU 명부(레버 4 이후).

## 2. 핵심 결정 (브레인스토밍 확정)

1. **매칭 전략 = 큐레이션 레지스트리 플래그(정밀 우선).** 명부 CSV를 런타임에 적재/배포하지 않는다. 오프라인 검증 스크립트가 우리 레지스트리 회사를 명부와 정밀 매칭해, 검증된 회사 항목에 `companies.json`의 `uk_sponsor: true` 플래그를 단다(사람 검토 후 커밋). 런타임은 이 작은 플래그만 읽는다. 잡보드 자유텍스트 회사는 커버하지 않는다(이후 하이브리드 확장 가능).
2. **위치 게이팅 = UK 소재만(보수적).** 플래그된 회사라도 공고 `location`이 UK 신호를 가질 때만 전환. EU/US/모호한 remote는 unclear 유지. UK 라이선스는 UK 채용 스폰서이므로 베를린/뉴욕 공고를 sponsors로 찍지 않는다.
3. **표기 = 기존 `sponsors` 재사용 + 투명한 evidence.** `visa_status='sponsors'`로 동일하게 두고 `visa_evidence`에 출처를 명시한다. 기존 스폰서 우선 정렬·VisaBadge·검색 필터가 그대로 적용된다. 이는 reclassify의 기존 "회사 추론" 단계(같은 회사의 다른 공고에 스폰서 명시 → sponsors)와 동일한 회사 단위 사실 패턴이다.

## 3. 아키텍처 / 데이터 흐름

```
[오프라인, 가끔(월 단위 권장)]  ai/scripts/verify_uk_sponsors.py
  gov.uk publication 페이지에서 당일 CSV 링크 파싱 → CSV 다운
  → 레지스트리 회사와 정밀 정규화 매칭(매칭 org명 동봉 출력)
  → 후보 리스트 출력 → 사람 검토 → companies.json "uk_sponsor": true 수동 커밋

[런타임, 매 ETL 사이클]  reclassify_unclear_visa
  keyword → ★UK 레지스터 매칭(신규)★ → LLM → 회사추론
       │ unclear 공고마다:
       │   company_slug ∈ uk_sponsor_slugs()  (레지스트리에서 로드)
       │   AND is_uk_location(location, is_remote)  (신규 analyzer)
       │   → ("sponsors", ["회사가 UK 스폰서 라이선스 보유 (Home Office 등록 스폰서 명부)"])
```

UK 매칭을 **LLM 앞**에 둔다: 무료·사실 기반이라 먼저 처리하면 LLM 호출량(비용)을 줄인다. 기존 unclear 공고는 다음 reclassify 실행 때 즉시 소급 적용된다.

## 4. 컴포넌트 상세

### 4.1 `ai/dev_jobs_core/data/companies.json` — 플래그 추가
검증 통과 회사 항목에 `"uk_sponsor": true` 추가. 예:
`"monzo": {"ats": "greenhouse", "token": "monzo", "tags": ["fintech","europe"], "uk_sponsor": true}`.
키 없으면 false 취급.

### 4.2 `ai/dev_jobs_core/registry.py` — 헬퍼
`uk_sponsor_slugs() -> set[str]`: `uk_sponsor`가 true인 회사의 `token` 집합 반환. 기존 `_load()` 재사용.

### 4.3 `ai/dev_jobs_core/analyzers/uk_location.py` — 신규 (위치 판별, 순수 함수)
`is_uk_location(location: str | None, is_remote: bool = False) -> bool`. 네트워크 없음.
- UK 국가/지역 신호: `United Kingdom`, 단어경계 `UK`, `England`, `Scotland`, `Wales`, `Northern Ireland`, 단어경계 `GB`.
- 주요 UK 도시: London, Manchester, Edinburgh, Glasgow, Birmingham, Leeds, Bristol, Cardiff, Belfast, Cambridge, Oxford, Liverpool, Sheffield, Nottingham, Newcastle, Brighton, Reading.
- "Remote (UK)" / "Remote - United Kingdom" 류 포함.
- 모호한 remote("Remote", "Remote - Europe"), EU·US, None/빈문자 → False.
- 대소문자 무시 + 단어경계 정규식으로 오탐 방지.

### 4.4 `ai/app/db.py` — `fetch_unclear_jobs`에 컬럼 추가
현재 `SELECT id, title, description_text, company_slug` → `location, is_remote` 추가. 다른 호출부(키워드/LLM 단계)는 추가 컬럼을 무시하므로 영향 없음.

### 4.5 `ai/app/etl/visa_reclassify.py` — 신규 단계 삽입
keyword 단계 직후, LLM 앞에 UK 매칭 단계 삽입:
```python
uk_slugs = uk_sponsor_slugs()
UK_EVIDENCE = "회사가 UK 스폰서 라이선스 보유 (Home Office 등록 스폰서 명부)"
still = []
for j in remaining:                      # keyword 단계 후 아직 unclear
    if j["company_slug"] in uk_slugs and is_uk_location(j.get("location"), j.get("is_remote", False)):
        results[j["id"]] = ("sponsors", [UK_EVIDENCE])
        by_uk_register += 1
    else:
        still.append(j)
remaining = still                         # LLM 은 그래도 남은 것만
```
반환 통계 dict에 `by_uk_register` 추가. 기존 회사추론(step 3)·UPDATE 로직은 유지.

### 4.6 `ai/scripts/verify_uk_sponsors.py` — 신규 (오프라인 도구)
- gov.uk publication 페이지(`https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers`)에서 당일 CSV 링크를 찾아 다운(또는 인자로 CSV 경로 받기).
- 레지스트리 회사명/토큰을 명부 `Organisation Name`과 **정밀 정규화 매칭**: 소문자화, 법인 접미사 제거(ltd/limited/plc/inc/llc/gmbh/group/uk/holdings/bank/payments/europe 등), 구두점 제거 후 **정확 일치 또는 명부 org가 우리 회사명으로 시작(단어경계)**. 우리 회사명이 4자 미만이면 정확 일치만 허용(short-name 오탐 방지).
- 출력: 매칭된 (회사, 매칭 org명, town)을 나열 → 사람이 오탐(Asana→Asana Healthcare, Notion→Notion Capital, Dropbox→Dropbox Fuels 류) 걸러내고 companies.json에 수동 반영.
- 재실행으로 갱신(라이선스 변동 반영). 런타임 ETL과 무관(오프라인).

## 5. 에러 처리 / 엣지 케이스

- 플래그 없는 회사·잡보드 자유텍스트 회사: 건드리지 않음(unclear 유지, 후속 단계가 처리).
- `location` NULL/빈: `is_uk_location(None)` → False, 전환 안 함(보수적).
- 이미 sponsors/no_sponsor: reclassify는 `is_active AND visa_status='unclear'`만 조회 → 절대 덮어쓰지 않음.
- 검증 스크립트 네트워크 실패: 명확히 에러 출력 후 종료. 오프라인 도구라 런타임 ETL 무영향.
- 명부에서 라이선스 빠진 회사: 재실행 시 후보에서 사라짐 → 검토 후 플래그 제거(자동 아님).

## 6. 테스트 (전부 네트워크 없음)

- `is_uk_location`: UK 국가/도시/`Remote (UK)` → True; Berlin/NYC/`Remote`/`Remote - Europe`/None → False; 단어경계 오탐 케이스.
- `uk_sponsor_slugs()`: `uk_sponsor: true`만 포함, 키 없으면 제외.
- reclassify UK 단계(테스트 DB 또는 mock conn): ① 플래그회사+UK위치 unclear → sponsors(+evidence) ② 플래그회사+Berlin → unclear 유지 ③ 비플래그회사+UK위치 → 변화 없음 ④ no_sponsor 공고 → 안 건드림. `by_uk_register` 통계 검증.
- 검증 스크립트 정규화 매칭 함수: 픽스처로 정확/접두 일치 통과 + 오탐(Asana Healthcare 류) 비매칭.
- companies.json 가드 테스트 확장: `uk_sponsor` 존재 시 bool만 허용.

## 7. 범위 밖 (YAGNI)

- 잡보드 자유텍스트 회사 CSV 매칭(이후 하이브리드).
- 별도 비자 티어/배지 신설(기존 sponsors 재사용).
- 명부 자동 일일 동기화(수동 큐레이션 갱신).
- US H-1B(레버 4)·EU 각국 명부.
- 구조화된 country 컬럼(현 free-text location 휴리스틱으로 충분).

## 8. 기대 효과

플래그 회사(~75-83곳)의 UK 소재 unclear 공고가 sponsors로 전환 → unclear 최대 감소 레버. 스폰서 우선 정렬과 시너지(전환된 공고가 상위 노출). 정확한 전환 건수는 머지 후 reclassify 실행 시 `by_uk_register` 통계로 확정한다(현재 라이브 DB 미가동이라 사전 미측정).
