# 공고 날짜 UI 개선 설계 (상시채용 + 게시 신선도)

> 작성일 2026-05-31. 마감일이 거의 없는 현실에 맞춰 공고 날짜 표기를 개선. 웹 전용.

## 1. 배경과 목표

라이브 조사 결과, 어떤 소스도 마감일을 사실상 제공하지 않는다(arbeitnow/ashby/lever/remoteok/smartrecruiters는 마감일 필드 자체가 없고, greenhouse는 필드는 있으나 활성 1,420개 중 0개가 채워짐). 본문에 마감 표현이 있는 공고는 ~2%뿐이며 그마저 대부분 "no closing date / ongoing" 선언이었다. 즉 **공고 대부분이 상시/롤링 채용**이다.

따라서 마감일 추출(소스/커넥터 변경)은 데이터 부재로 불가능하며 — 없는 날짜를 만들면 가짜 데이터다 — UI에서 이 현실을 정직하게 반영한다.

**목표:** 마감일이 없으면 `상시채용`으로 표기하고, 게시일을 신선도(상대 표기)로 명확히 한다. 사용자에게 의미 없는 raw `job.id` 노출은 제거한다.

**비목표:** 커넥터/소스 마감일 추출(데이터 없음), 백엔드/DB/ETL 변경, RecommendationCard(날짜 미표시).

## 2. 핵심 결정 (브레인스토밍 확정)

1. **마감일 없으면 `상시채용`.** 채용 사이트 표준 관례이고, 신선도 메커니즘(소스 피드에서 7일 미관측 시 비활성)으로 "현재 모집 중"이 보장돼 오해 위험이 낮다. 마감일이 있으면(greenhouse가 채우면 자동) 기존 `마감 D-N` 유지.
2. **게시일 = 상대 신선도 표기**(`오늘/어제/N일 전 게시`, 오래되면 날짜).
3. **raw `job.id` 숨김**(카드·상세 메타에서 `arbeitnow:...` 노출 제거).
4. **웹 전용**(#2 마감일 추출은 데이터 부재로 드롭, greenhouse 기존 추출은 그대로).

## 3. 컴포넌트 상세

### 3.1 `web/lib/jobDates.ts` — 신규 (순수 함수, 부수효과 없음)
- `postedLabel(posted_at?: string): string | null`
  - 파싱 실패/없음 → `null`.
  - 오늘 → `"오늘 게시"`, 어제 → `"어제 게시"`, 2~13일 → `"N일 전 게시"`, 그 외 → `"YYYY. M. D. 게시"`(ko-KR 로캘 날짜 + " 게시").
- `deadlineLabel(closes_at?: string): { text: string; urgent: boolean }`
  - `closes_at` 있고 파싱 성공:
    - 남은일수 `d = ceil((closes - now)/일)`.
    - `d >= 0` → `{ text: "마감 YYYY. M. D. (D-d)", urgent: d <= 7 }`.
    - `d < 0` → `{ text: "마감 YYYY. M. D. (마감)", urgent: false }`.
  - 없음/파싱 실패 → `{ text: "상시채용", urgent: false }`.
- `Date.now()` 사용은 클라이언트 렌더 기준(상대 표기·D-N 모두 기존 상세 페이지가 이미 `Date.now()` 사용 중이라 동일 패턴).

### 3.2 `web/components/job/JobCard.tsx` — 수정
현재 메타 행:
```tsx
{salary && <span className="font-mono text-foreground">{salary}</span>}
{posted && <span>{posted}</span>}
<span className="font-mono">{job.id}</span>
```
변경:
- 기존 `formatDate`/`posted` 대신 `postedLabel(job.posted_at)` 사용.
- `job.id` span 제거.
- `deadlineLabel(job.closes_at)` 추가: `상시채용`(muted) 또는 `마감 D-N`(urgent면 강조).
결과 메타: `salary · {posted 상대표기} · {상시채용|마감 D-N}`.

### 3.3 `web/app/jobs/[id]/page.tsx` — 수정
현재 메타 행: `{posted} 게시` + 조건부 `마감 D-N` + `{job.id}`.
변경:
- `posted` 표기를 `postedLabel`로(상대 표기 포함). 또는 절대날짜 + 상대 병기(`"YYYY.M.D 게시 · N일 전"`). 구현은 `postedLabel` 사용으로 통일.
- 마감 블록을 `deadlineLabel`로 통일(없으면 `상시채용` 표시, 기존엔 아무것도 안 나왔음).
- `{job.id}` span 제거.

## 4. 에러 처리 / 엣지
- `posted_at` 없음/파싱 실패 → 게시일 미표시(`null`).
- `closes_at` 없음/파싱 실패 → `상시채용`.
- 과거 마감일(`d<0`) → `마감 (마감)` (기존 동작 유지).
- 시간대: 기존 상세 페이지와 동일하게 `Date`/`Date.now()` 클라이언트 기준(분 단위 정확도 불필요, 일 단위 표기).

## 5. 검증 (웹 기존 관행: 새 테스트 인프라 없음)
- `web/lib/jobDates.ts`는 순수 함수로 자명하게 작성.
- `cd web && npx tsc --noEmit` 통과.
- **라이브 비주얼**(dev 스택 + Playwright): (a) 마감일 없는 공고(arbeitnow 등) → `상시채용` 표시, (b) 게시일 상대 표기(`N일 전 게시`), (c) 카드·상세에서 raw `job.id` 사라짐, (d) greenhouse에 마감일 있는 케이스가 있으면 `마감 D-N` 유지. 스크린샷/스냅샷.

## 6. 범위 밖 (YAGNI)
- 커넥터/소스 마감일 추출(데이터 부재).
- 본문 텍스트 마감일 파싱(~2%, 대부분 "마감 없음" 선언이라 무가치).
- 백엔드/DB/ETL, RecommendationCard.
- 합성 마감일 생성(가짜 데이터 금지).

## 7. 기대 효과
공고 카드·상세에서 게시일이 신선도로 명확해지고, 마감일 없는 대다수 공고가 `상시채용`으로 정직하게 표기된다. 의미 없는 raw job.id 노출 제거로 UI가 깔끔해진다. 마감일은 데이터가 있으면(greenhouse) 자동으로 `마감 D-N` 표시.
