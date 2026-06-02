# 합쳐진 랜딩 디자인 — Jaabz + SponsorMap

날짜: 2026-06-02
상태: 설계 승인 대기
대상: 웹 홈 랜딩 페이지 (`web/app/page.tsx` + `web/components/home/*`)

## 배경 / 동기

레퍼런스 조사에서 두 사이트를 골랐고, 둘 다 본 프로젝트의 핵심 자산과 1:1로 맞물린다.

- **Jaabz** (https://jaabz.com) — 인디고/블루 모던 SaaS. 히어로 통계 카운터, **트랙 토글 탭(Visa/Relocation/Remote)** + 대형 검색, 배지 카드 그리드, "Explore Global Careers" 트랙 카드, FAQ.
  - ↔ 프로젝트의 **원격/이주/둘다 듀얼트랙 소프트포크 + TrackPicker**와 직결.
- **SponsorMap** (https://sponsormap.uk) — 네이비+앰버 에디토리얼/세리프. **"HOME OFFICE REGISTER · UPDATED DAILY" 신뢰 pill**, 세리프 이탤릭 강조 헤드라인("employers who *can actually hire you*"), **실제 회사 로고 칩**, "Free, no sign-up" 마이크로카피, **권위 통계 스트립**(125k+ 등재 스폰서 / 라이브 비자잡 / 도시 / 급여 임계값).
  - ↔ 프로젝트의 **UK 내무부 명부 + US USCIS 데이터 대조 → 사실전환**(by_uk_register, sponsors 1307건)과 직결.

따라서 이 작업은 "남의 스킨 이식"이 아니라 **이미 가진 두 강점(듀얼트랙 · 명부 대조)을 두 레퍼런스의 검증된 패턴으로 드러내는 것**이다.

## 승인된 방향 (결정 사항)

- **비주얼 톤**: 구조 + 권위 액센트. DESIGN.md의 indigo-minimal 정체성 유지 + SponsorMap의 "명부 권위" 느낌만 선택적 도입. 액션은 끝까지 indigo.
- **세리프 폰트**: Source Serif 4 (Inter와 같은 가문, 모던). 신뢰 강조 헤드라인 전용.
- **카드 verified 마커**: v1은 **홈 카드에만** (전역 VisaBadge는 후속 PR).
- **추가 섹션**: **FAQ만** 추가 (Jaabz의 "Explore by track" 카드 섹션은 제외).

## 디자인 토큰 추가 (DESIGN.md / tailwind / globals.css)

토큰을 2개만 추가한다. single source of truth는 DESIGN.md → tailwind.config.ts + globals.css.

### 1) `fonts.serif` — Source Serif 4

- 용도: **신뢰 강조 헤드라인의 이탤릭 구절 전용** (예: "*실제로 채용 가능한*"). 본문/UI/숫자는 전부 기존 sans/mono 유지.
- 폰트 스택: `"Source Serif 4", "Source Serif Pro", Georgia, "Pretendard Variable", serif` (한글 폴백 Pretendard).
- 로딩: 기존 폰트가 next/font가 아니라 CSS 스택 의존이므로, Source Serif 4도 `globals.css`에 Google Fonts `@import` (또는 `app/layout.tsx`에 `<link>`) 1줄 추가. weight 400/600, **italic 포함** 필수.
- tailwind: `fontFamily.serif` 추가. 사용은 `font-serif italic` 유틸.

### 2) `colors.*.verified` — 골드 액센트

- 용도: **"명부 대조 검증" 신호 전용**. credibility pill, 권위 통계 중 "명부검증/직접대조" 숫자, 홈 카드 ✓ 마커.
- **`warning`(amber, 낮은 disclosure 주의)과 의미·색조 분리** — verified는 더 깊은 골드.
- 값:
  - light: `verified: #ca8a04` (yellow-600/gold), `verified-foreground: #ffffff`
  - dark: `verified: #eab308` (yellow-500), `verified-foreground: #09090b`
- tint 사용 패턴: 텍스트는 `verified`, 배경은 `verified/10%`(기존 VisaBadge sponsors가 success로 하는 방식과 동일).
- globals.css CSS 변수(`--verified`, `--verified-foreground`) + tailwind `colors.verified` 매핑.

DESIGN.md 본문에도 위 두 토큰의 근거 문단을 추가한다 (Color 섹션에 verified, Typography 섹션에 serif 용도).

## 랜딩 레이아웃 (섹션별)

### A. Hero 재구성 (`components/home/Hero.tsx`)

기존 자산(NlRecommend, HeroStats)을 유지하면서 SponsorMap의 권위 요소를 덧입힌다.

```
┌─────────────────────────────────────────────┐
│  🛡 UK 내무부 명부 · US USCIS 대조 · 매일 갱신   │ ← (NEW) verified 골드 pill
│                                               │
│  조건만 말하면, AI가  실제로 채용 가능한        │ ← serif italic gold 강조
│         비자 스폰서 공고를 찾아드려요            │   나머지는 기존 sans display
│                                               │
│   [ NlRecommend 자연어 입력 + 추천받기 ]        │ ← 기존 유지
│      또는 조건으로 직접 검색                     │
│                                               │
│  무료 · 회원가입 불필요   ✓ 이미 등재된 스폰서:  │ ← (NEW) 마이크로카피
│   [HSBC] [SAP] [Grab] [ServiceNow] ...        │ ← (NEW) 실제 로고 칩
└─────────────────────────────────────────────┘
   1,307 명부검증 스폰서 · 2.4k+ 라이브공고 · 16개국 · 116 UK명부 직접대조
   ↑ (CHANGED) 권위 통계 스트립 (indigo/zinc), 카운트업 애니메이션
```

신규/변경 요소:
1. **CredibilityPill** (신규 컴포넌트, `components/home/CredibilityPill.tsx`)
   - 텍스트: "UK 내무부 명부 · US USCIS 대조 · 매일 갱신". 작은 shield/✓ 아이콘 + `verified` 골드 tint pill(radius full).
   - 정적 카피. 데이터 의존 없음.
2. **세리프 강조 헤드라인** — 기존 `<h1 text-display>`에서 핵심 구절만 `<span class="font-serif italic text-verified">실제로 채용 가능한</span>`. SponsorMap의 "can actually hire you" 신뢰 클레임을 한국어로 번역한 톤. 나머지는 기존 sans display 그대로.
3. **NlRecommend** — 변경 없음 (프로젝트 히어로 자산).
4. **TrustChips** (신규, `components/home/SponsorChips.tsx`)
   - "무료 · 회원가입 불필요" 마이크로카피 + "✓ 이미 등재된 스폰서:" 라벨 + 검증된 스폰서 회사 로고 칩 4~6개.
   - 로고는 기존 `web/lib/logo.ts`의 `logoUrl` 재사용, 이니셜 폴백. 회사는 명부 검증 회사(예: HSBC/SAP/Grab/ServiceNow) 중 `fetchCompanies` 상위에서 선별하거나 정적 화이트리스트.
5. **권위 통계 스트립** (`HeroStats.tsx` 재작업)
   - SponsorMap식 가로 4칸 스트립이되 색은 indigo/zinc. 숫자를 **명부 권위 중심으로 재프레이밍**:
     - "명부 검증 스폰서" = `stats.sponsors`(1,307)
     - "라이브 공고" = `stats.total`
     - "국가" = `stats.countries`
     - "UK 명부 직접 대조" = 신규 stat (by_uk_register 건수). page.tsx에서 데이터 수급 필요 — 없으면 이 칸은 생략하고 "회사 수"로 폴백.
   - 숫자는 mono 또는 sans, 카운트업 애니메이션(작은 클라이언트 컴포넌트). 검증 관련 숫자에 `verified` 골드 점/언더라인 1px 신호.

### B. 트랙 탭 블록 (`components/home/TrackPicker.tsx` 승격)

현재 "어떤 길을 찾고 계세요?" + TrackPicker를 Jaabz식 **탭형 검색 블록**으로.
- 탭: `[ 비자 스폰서 | 이주 | 원격 ]`. 활성 탭 indigo 언더라인.
- 탭 아래 검색 입력(선택) → 탭의 track + 쿼리로 `/search?track=...` 라우팅. 기존 듀얼트랙 소프트포크/`track` 쿼리 파라미터 그대로 연결.
- 최소 변경 옵션: 검색 입력 없이 탭만으로 `/search?track=...` 이동(기존 TrackPicker 동작 유지 + Jaabz 탭 스타일만). v1은 이 최소안 채택, 검색 입력은 후속.

### C. 기존 섹션 (유지 + 손질)

- **비자 스폰서십 공고** (JobScrollRow) — 명부 대조된 공고(예: `job.sponsorSource`가 `uk_register`/`us_h1b`)면 카드에 `✓` `verified` 골드 마커. **홈 카드에만** 적용 (JobScrollRow가 쓰는 JobCard에 prop으로 verified 표시, 전역 VisaBadge 미변경).
  - 데이터: job 객체에 명부 출처 필드가 이미 있으면 사용, 없으면 v1은 "비자 sponsors인데 source가 명부" 조건이 불가하므로 마커 생략하고 후속에서 백엔드 필드 추가. (구현 시 백엔드 응답 확인 — 없으면 마커는 후속으로 분리)
- 국가별로 찾기 (CountryTiles) / 새로 올라온 공고 / 주목할 회사 (CompanySpotlight) — 변경 없음.

### D. FAQ 섹션 (신규, `components/home/FaqSection.tsx`)

- 신뢰/명부 중심 FAQ 아코디언 4~6개. 기존 Dialog/네이티브 details 패턴 또는 shadcn accordion.
- 항목 예: "'명부 검증'이 무슨 뜻인가요?" / "비자 스폰서십 공고는 어떻게 확인하나요?" / "원격/이주 트랙 차이는?" / "무료인가요?" / "공고는 얼마나 자주 갱신되나요?".
- 정적 카피. 데이터 의존 없음.

## 컴포넌트 경계 요약

| 컴포넌트 | 신규/변경 | 책임 | 의존 |
|---|---|---|---|
| `CredibilityPill` | 신규 | 명부 권위 pill (정적) | 없음 |
| `SponsorChips` | 신규 | 검증 스폰서 로고 칩 행 | `lib/logo.ts`, 회사 목록 |
| `FaqSection` | 신규 | 신뢰 FAQ 아코디언 (정적) | 없음 |
| `Hero` | 변경 | 위 요소 조합 + 세리프 헤드라인 | CredibilityPill, NlRecommend, SponsorChips, HeroStats |
| `HeroStats` | 변경 | 권위 통계 스트립 + 카운트업 | stats |
| `TrackPicker` | 변경 | Jaabz식 탭 스타일 | 기존 track 라우팅 |
| `JobCard`(home) | 변경 | verified 골드 마커 prop | 명부 출처 필드 |
| `page.tsx` | 변경 | 섹션 조립 + FAQ 추가 + (가능시) 명부대조 stat 수급 | api |
| DESIGN.md / tailwind / globals.css | 변경 | serif·verified 토큰 | 없음 |

## 스코프 경계

- **포함(v1):** 홈 랜딩 (Hero 권위 재구성, CredibilityPill, 세리프 헤드라인, SponsorChips, 권위 통계 스트립, 트랙 탭 스타일, 홈 카드 verified 마커, FAQ), DESIGN.md 토큰 2개(serif/verified).
- **제외(후속):** `/search` 페이지 reskin, 전역 VisaBadge verified 마커, Jaabz "Explore by track" 카드 섹션, 뉴스레터 CTA, 전체 카드 그리드 reskin.

## 검증 계획

- 라이트/다크 양 모드 스크린샷 비교 (verified 골드 대비 확인).
- verified와 warning 색이 한 화면에서 구분되는지 육안 확인.
- 트랙 탭 → `/search?track=...` 라우팅 동작.
- 모바일(sm) 반응형: 통계 스트립 2x2, 로고 칩 줄바꿈, 세리프 헤드라인 줄간격.
- 명부대조 stat/카드 마커는 백엔드 필드 유무에 따라 조건부 — 필드 없으면 해당 부분만 후속으로 분리(랜딩 나머지는 그대로 진행).
