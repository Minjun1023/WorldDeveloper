# 한국인 취업 가능성 게이트 + 원격 적격(remote_eligibility) 설계

작성일: 2026-06-01
상태: 설계 확정 (구현 계획 대기)

## 1. 배경 / 문제

WorldDeveloper는 한국인의 해외 개발자 취업을 위한 사이트다. 해외 개발자로 취업하는 경로는 둘뿐이다:

1. **이주(relocation)** — 비자 스폰을 받아 현지로 이사해 근무. 이미 `visa_status`(sponsors/no_sponsor/unclear) + UK/US 스폰서 레지스터 대조로 검증 중.
2. **원격(remote)** — 한국에 거주하면서 해외 기업에서 원격 근무. **현재 이 축을 검증하는 데이터가 없다.**

기존 원격 잡보드(WWR, RemoteOK 등)는 "Remote (US only)"를 그냥 "Remote"로 표기하는 노이즈가 심해서, 한국 거주자가 지원했다가 "US 거주자만" 조건으로 자동 탈락하는 헛수고가 많다. 이 설계는 **"한국에 앉아서도 지원 가능한 공고냐"** 를 검증하는 새 데이터 축 `remote_eligibility`를 추가하고, 두 경로(이주/원격) 모두에서 **한국인에게 길이 없는 공고를 걸러낸다.**

## 2. 목표 / 비목표

### 목표
- 원격 공고를 "한국 거주자가 지원 가능한 권역인가"로 분류하는 데이터 축 추가.
- 한국인에게 길이 막힌 공고를 기본 화면에서 제거(신뢰감).
- 두 트랙(이주/원격)을 정문에서 명시적으로 안내하되, 유연한 사용자도 배려(소프트 포크).

### 비목표 (YAGNI)
- v1에서 LLM 재분류 없음 (location 파싱 + 키워드만). 정확도 보강은 후속.
- 회사 단위 "글로벌 채용" 레지스터 구축 없음 (후속 후보).
- EOR/컨트랙터 고용형태 분류 없음 (단일 지역 등급만).
- 타임존 정밀 오버랩 계산 없음 (키워드 수준 신호만).

## 3. 핵심 개념: 취업 가능성(viability) 게이트

한국인이 공고를 **실제로 취할 수 있는** 조건:

```
viable = (visa_status == 'sponsors')
         OR (remote_eligibility IN ('worldwide', 'apac_ok'))
```

분류 등급:

| 축 | 값 | 한국인 의미 |
|---|---|---|
| visa_status | sponsors | 이주 가능 |
| | no_sponsor | 이주 불가 (명시적 거부) |
| | unclear | 비자 정보 없음 (판정 불가) |
| remote_eligibility | worldwide | 전 세계 원격 → 한국 포함, 가능 |
| | apac_ok | APAC/아시아 권역 → 한국 포함, 가능 |
| | region_restricted | 특정 권역 한정, **한국 제외** → 불가 |
| | unclear | 권역 명시 없는 원격 → 판정 불가 |
| | null | 원격 아님(온사이트) |

`unclear`는 "안 되는 공고"가 아니라 **"우리가 판정 못 한 공고"** 다. 분류기 한계이지 공고 속성이 아니므로, 삭제하지 않고 기본 숨김 + 옵트인으로 다룬다.

### 3개 노출 계층

1. **ETL 드롭 (확정 막힘만 영구 제거):**
   ```
   dead_end = (visa_status == 'no_sponsor')
              AND (NOT is_remote OR remote_eligibility == 'region_restricted')
   ```
   두 축 모두 **명시적 "안 됨"** 인 공고만. 적재하지 않는다. (확정 부정만 드롭 — `unclear`는 절대 드롭하지 않는다. 레지스터/분류기 개선 시 살아날 수 있으므로.)

2. **기본 화면 = viable 공고만:** `visa_status='sponsors' OR remote_eligibility IN ('worldwide','apac_ok')`.

3. **`unclear`는 기본 숨김 + "미확인 공고 포함" 토글:** 파볼 사람에게만 노출. 시간이 지나며 unclear 자체를 줄이는 게 근본 해법(비자 레지스터처럼 원격도 신호 보강).

기본 사이트 약속: **"여기 보이는 건 다 한국인이 실제로 지원 가능한 공고."**

## 4. 컴포넌트 설계

### 4.1 분석기 — `ai/dev_jobs_core/analyzers/remote_geo.py`

`analyzers/visa.py`를 미러. (주의: `dev-jobs-mcp/dev_jobs_mcp/analyzers/`에도 같은 분석기 패키지 복제본이 있다. ETL은 `ai/dev_jobs_core`를 사용하므로 그쪽이 정본. MCP가 동일 로직을 쓰면 복제 동기화 필요.)

```python
def classify_remote_eligibility(
    location: str, is_remote: bool, description: str
) -> tuple[str | None, list[str]]:
    """원격 공고의 한국 거주자 지원 가능 권역을 분류.

    Returns:
        status: "worldwide" / "apac_ok" / "region_restricted" / "unclear",
                또는 원격이 아니면 None
        evidence: 판정 근거 문장/단편 리스트
    """
```

**처리 순서:**
- `is_remote == False` → `(None, [])` (이 축은 원격 공고에만 적용)
- Layer 1: `location` 문자열 정규화 파싱 (강한 신호)
- Layer 2: `description` 키워드 정규식 (보완 + 강한 부정 신호)

**우선순위 (precedence) — `region_restricted`가 최우선 승리:**
1. 명시적 비-한국 권역 한정 신호 있음 → `region_restricted` (비자의 `no_sponsor`처럼 강한 부정이 이김. 한국인에게 헛된 희망 방지)
2. worldwide 신호 있음 → `worldwide`
3. APAC/아시아/한국 포함 권역 신호 있음 → `apac_ok`
4. 그 외 → `unclear` (원격이지만 권역 불명 — 정직하게 unclear, worldwide로 추정 금지)

**권역 토큰 규칙 (구현 시 정규식, 대소문자 무시):**

- **worldwide**: `worldwide`, `world-wide`, `work from anywhere`, `remote anywhere`, `anywhere in the world`, `any location`, `any timezone`, `globally remote`, `fully remote, global`
  - 주의: 단독 "global"/"fully remote"는 약함 — 지리적 의미 없는 회사 자랑일 수 있음. "global"은 권역 맥락("global remote", "remote - global")일 때만.
- **apac_ok** (한국 포함 광역): `apac`, `asia-pacific`, `asia pacific`, `asia` (광역), `korea`, `south korea`, `seoul`, `KST`, `asia timezone(s)`
  - 핵심 구분: **광역 "APAC/Asia"는 한국 포함 → apac_ok. 특정 다른 APAC 국가 단독("Japan only", "Australia only")은 한국 제외 → region_restricted.**
- **region_restricted** (비-한국 권역 한정): `US`, `USA`, `U.S.`, `United States`, `Americas`, `North America`, `LATAM`, `Latin America`, `EMEA`, `EU`, `Europe`, `European`, `UK`, `United Kingdom`, `Canada`, `Australia`(단독), `Japan`(단독), `must be (based|located) in {non-KR}`, `residents of {non-KR}`, `authorized to work in {non-KR}`, `eligible to work in {non-KR}`, 타임존 한정: `PST`, `EST`, `CET`, `US timezone`, `European timezone`, `overlap with (US|Europe|EST|PST|CET)`

**엣지 케이스:**
- `"Remote - APAC"` → apac_ok
- `"Remote (US)"` / `"Remote, EMEA"` → region_restricted
- `"Remote - Worldwide"` → worldwide
- `"Remote"` 단독, 권역 무명시 → unclear
- `"Seoul, South Korea"` + is_remote → apac_ok
- `"Remote (US or EU)"` → region_restricted (둘 다 비-한국)
- location 비어있고 description에 "work from anywhere" → worldwide (Layer 2)

### 4.2 변환 통합 — `ai/app/etl/transform.py`

`classify_visa` 호출 바로 옆에 추가:

```python
from dev_jobs_core.analyzers.remote_geo import classify_remote_eligibility
...
status, evidence = classify_visa(j.description)
remote_status, remote_evidence = classify_remote_eligibility(
    j.location or "", bool(j.is_remote), j.description or ""
)
```

`job_row`에 추가:
```python
"remote_eligibility": remote_status,   # None 가능
"remote_evidence": remote_evidence,
```

### 4.3 ETL 드롭 — `ai/app/etl/jobs.py` (적재 루프)

upsert 직전 viability 게이트:
```python
dead_end = (
    job_row["visa_status"] == "no_sponsor"
    and (not job_row["is_remote"] or job_row["remote_eligibility"] == "region_restricted")
)
if dead_end:
    dropped += 1
    continue   # 적재하지 않음
```
드롭 카운트를 로그로 남긴다(기존 dev-filter/dedup 드롭 패턴과 동일하게, 무엇이 얼마나 빠졌는지 가시화).

### 4.4 DB 마이그레이션 — `backend/src/main/resources/db/migration/V10__job_remote_eligibility.sql`

`visa_status`/`visa_evidence` 컬럼을 미러:
```sql
ALTER TABLE jobs ADD COLUMN remote_eligibility TEXT;   -- worldwide/apac_ok/region_restricted/unclear/NULL
ALTER TABLE jobs ADD COLUMN remote_evidence   JSONB;

-- viable 필터 + 정렬용 인덱스 (visa 인덱스 미러)
CREATE INDEX idx_jobs_remote_elig_posted ON jobs (remote_eligibility, posted_at DESC);
```

### 4.5 백엔드 (Spring) — `JobEntity` / `JobRepository` / `JobService`

- **`JobEntity.java`**: `remoteEligibility` (`@Column(name="remote_eligibility")`), `remoteEvidence` 매핑 추가. getter 추가.
- **`JobRepository.java`** 네이티브 쿼리 확장:
  - viable 게이트 (기본): `(visa_status='sponsors' OR remote_eligibility IN ('worldwide','apac_ok'))`
  - `:includeUnclear` true면 게이트 해제 (DB엔 이미 확정 막힘이 없으므로 = unclear까지 노출).
  - `:track` 필터: `relocation`→비자 우선/관련, `remote`→`remote_eligibility IN ('worldwide','apac_ok')` 한정, `both`/null→viable 전체.
  - 정렬: 기존 `:visaPriority` CASE 옆에 remote 티어 CASE 추가 (worldwide=0, apac_ok=1, 그 외 하위). track에 따라 어느 축이 1순위 정렬키인지 결정.
- **`JobService.java`**: `track`, `includeUnclear` 파라미터 수용. 기본값 = track 없음(viable 전체), includeUnclear=false.
- **facets**: 기존 `countByVisaStatus` 옆에 `countByRemoteEligibility` 추가(선택, 필터 UI 카운트용).

### 4.6 웹 (Next.js)

- **소프트 포크 랜딩** (신규): 첫 진입 시 3갈래.
  ```
  해외 개발자 취업, 어떻게 가고 싶으세요?
   [이주하고 싶어요]   [한국에 살면서 원격]   [둘 다 / 아직 모르겠어요]
    track=relocation     track=remote          track=both(통합)
  ```
  선택은 query param/상태로 저장. 헤더에서 언제든 트랙 전환 가능(되돌리기 쉬움).
- **`web/lib/types.ts`**: `RemoteEligibility = "worldwide" | "apac_ok" | "region_restricted" | "unclear"`, `Job.remote_eligibility?` 추가.
- **`RemoteBadge.tsx`** (신규, `VisaBadge.tsx` 미러): LABEL은 Partial — `worldwide`→"Worldwide", `apac_ok`→"APAC OK"만. `region_restricted`/`unclear`는 표시 안 함(정직 패턴).
- **필터 UI**: 트랙 토글(헤더) + "미확인 공고 포함" 토글(`includeUnclear`). `/search`와 홈 양쪽 적용.
- **정렬**: track=remote일 때 remote 티어 우선이 백엔드에서 적용되도록 sort 파라미터 연동.

## 5. 데이터 흐름

```
소스 공고 (location, is_remote, description)
  → transform.py
      classify_visa → (visa_status, visa_evidence)
      classify_remote_eligibility → (remote_eligibility, remote_evidence)
  → jobs.py viability 게이트
      dead_end(확정 막힘)? → 드롭(미적재)
      else → upsert (두 축 모두 저장)
  → Postgres jobs 테이블
  → 백엔드 JobRepository
      기본: viable 게이트(unclear 숨김)
      includeUnclear: 게이트 해제
      track: 축별 필터/정렬
  → 웹
      랜딩 소프트포크 → track 선택
      카드: RemoteBadge(worldwide/apac_ok만) + VisaBadge
      토글: 미확인 포함
```

## 6. 테스트 전략

- **`ai/dev_jobs_core/analyzers/test_remote_geo.py`** (크럭스, 테이블 기반 — visa 테스트 미러):
  - 각 등급 대표 케이스 (worldwide/apac_ok/region_restricted/unclear)
  - `is_remote=False` → None
  - 우선순위: restriction이 worldwide와 충돌 시 region_restricted 승리
  - 광역 APAC(apac_ok) vs 특정국 단독(region_restricted) 구분
  - 타임존 신호(PST/EST/CET → restricted)
  - location 빈 값 + description 신호 (Layer 2)
- **ETL 드롭 테스트**: dead_end 드롭, unclear 보존, viable 보존.
- **백엔드 `JobSearchTest`** 확장: 기본 쿼리가 unclear 숨김, includeUnclear가 노출, track 필터 동작, remote 티어 정렬.
- **웹**: RemoteBadge 렌더(worldwide/apac_ok만 보임), 토글 동작.

## 7. 구현 단계 (제안)

- **Phase 1 — 데이터 축**: 분석기 + transform 통합 + V10 마이그레이션 + ETL 드롭 + 분석기/드롭 테스트. (UI 없이 데이터부터 검증)
- **Phase 2 — 백엔드**: JobEntity/Repository/Service 확장(viable 게이트, track, includeUnclear, remote 티어 정렬) + 백엔드 테스트.
- **Phase 3 — 웹**: 소프트포크 랜딩 + RemoteBadge + 토글 + 트랙 전환 + 웹 테스트.

## 8. 리스크 / 주의

- **인벤토리 축소**: viable 기본 필터로 화면 공고가 줄어든다. `unclear` 토글로 완충하되, unclear 비율이 크면(비자 ~40%) 원격 신호 보강을 후속으로 우선해야 함.
- **분류 오탐**: 키워드만으로는 "US 본사지만 worldwide 원격" 같은 케이스를 놓칠 수 있음 → precedence에서 restriction을 보수적으로(명시적 한정 표현일 때만) 잡아 false-restricted를 줄인다. 모호하면 unclear로.
- **정본 중복**: 분석기가 `ai/dev_jobs_core`와 `dev-jobs-mcp` 두 곳에 존재. 정본은 ETL이 쓰는 `ai/dev_jobs_core`. MCP 동기화 여부 구현 시 결정.
- **이중 중첩 폴더 함정**: 실제 작업 경로는 `/Users/mac/WordDeveloper/WorldDeveloper/`.

## 9. 확정된 결정 요약

1. 출력: 단일 지역 등급 `remote_eligibility` (worldwide/apac_ok/region_restricted/unclear/null).
2. 신호: location 파싱 + 키워드, **LLM 없음** (v1).
3. 소비: 필터 + 배지 + 정렬, 모두 v1 범위.
4. 포지셔닝: 두 트랙 병행 + **소프트 포크 랜딩 A** (이주/원격/둘다).
5. viability 게이트: 확정 막힘은 ETL 드롭, viable만 기본 노출, **unclear는 기본 숨김 + 옵트인 토글**.
