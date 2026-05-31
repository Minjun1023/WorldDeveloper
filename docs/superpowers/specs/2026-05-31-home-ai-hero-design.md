# 홈 메인 페이지 개선 — AI 추천 중심 대화형 히어로 설계

> 작성일 2026-05-31. 홈(/)을 AI 자연어 추천 중심으로 재구성. 웹 전용. (헤더 개선[계정 드롭다운·모바일 햄버거]은 별도 후속 스펙.)

## 1. 배경과 목표

현재 홈은 약한 히어로(연회색 박스 + 헤드라인 + 구조화 검색바)와 거의 동일한 두 개의 가로 스크롤 공고 행으로 단조롭고, 강점(스폰서 명시 공고·회사 수·AI 추천)을 못 보여준다. 또 히어로 검색바와 별도 "나에게 맞는 공고"(NL 추천) 입력이 가까이 중복된다.

브레인스토밍에서 홈의 1순위 목적 = **AI 추천 강조**로 결정. 히어로를 자연어 추천(NlRecommend)을 주인공으로 하는 "대화형 히어로(A안)"로 재구성한다.

**목표:** 히어로에서 자연어 한 문장으로 맞춤 공고를 바로 추천받게 하고(프리셋 칩으로 진입장벽 낮춤), 신뢰 수치로 규모를 보여주며, 중복 입력을 없앤다.

**비목표:** 백엔드/추천 알고리즘 변경(기존 `/api/recommend-nl` 그대로), 헤더 개선(별도 스펙), 디자인 시스템 전면 개편.

## 2. 핵심 결정 (브레인스토밍 확정)

1. **히어로 = 대화형 AI 추천(A안).** 큰 NL 프롬프트 입력 + "추천 받기" + 프리셋 칩 + 신뢰 수치 띠. 결과는 기존처럼 인페이지(히어로 아래)에 RecommendationCard로 렌더.
2. **중복 제거.** 기존 별도 "나에게 맞는 공고" 섹션 삭제(NL 추천이 히어로로 흡수).
3. **구조화 검색은 보조.** 히어로의 기존 `HeroSearch`(키워드+지역/직무/비자 드롭다운)는 히어로에서 빼고, 작은 보조 링크 "조건으로 직접 검색 →"(`/search`)로 대체.
4. **신뢰 수치 띠 = 실데이터(하드코딩 금지).** 비자 스폰서 공고 수(강조·초록) / 전체 공고 / 회사 / 국가 — 모두 기존 API에서 동적 집계.
5. **웹 전용.** 백엔드/DB 무변경.

## 3. 아키텍처 / 데이터 흐름

```
app/page.tsx (서버, force-dynamic)
  병렬 fetch: 스폰서공고(visa=sponsors, total) · 전체공고(pageSize:1, total) ·
              최신공고(sort=newest) · 회사(fetchCompanies: items+total) · 지역(fetchRegions)
  → stats = { sponsors: visaTotal, total: jobsTotal, companies: companiesTotal, countries: regions.length }
  → <Hero regions stats />        (NlRecommend + 프리셋칩 + 수치띠 + 보조 검색링크)
  → 비자 스폰서십 공고(JobScrollRow, 초록 악센트)
  → 국가별로 찾기(CountryTiles)
  → 새로 올라온 공고(JobScrollRow)
  → 주목할 회사(CompanySpotlight)
  ※ 기존 "나에게 맞는 공고" 섹션 제거
```

## 4. 컴포넌트 상세

### 4.1 `web/components/home/Hero.tsx` — 재작성
- props: `{ regions: RegionCount[]; stats: HomeStats }`.
- 구성(세로 중앙 정렬, 기존 `hero-gradient` 유지):
  - 작은 라벨("한국 개발자 · 유럽 진출").
  - 헤드라인: "조건만 말하면, AI가 맞는 비자 스폰서 공고를 찾아드려요"(`비자 스폰서`는 기존처럼 `text-primary` 또는 강조).
  - 서브타이틀: "이력서·기술스택·원하는 조건을 자유롭게 적어보세요. 6차원 점수로 추천합니다."
  - `<NlRecommend presets={HERO_PRESETS} />` — 큰 입력 + 추천 버튼 + 프리셋 칩(아래 4.2).
  - 보조 링크: "또는 조건으로 직접 검색 →" → `/search`.
  - `<HeroStats stats={stats} />`(4.3).
- `HeroSearch` import/사용 제거(히어로에서). `HeroSearch.tsx` 파일은 삭제하지 않고 남겨둠(다른 곳 미사용이면 후속 정리; 이번 범위 밖). 단 미사용 import는 남기지 않음.

### 4.2 `web/components/home/NlRecommend.tsx` — 프리셋 칩 추가(기존 동작 유지)
- 새 옵셔널 prop: `presets?: { label: string; prompt: string }[]`.
- 입력 폼 아래에 프리셋 칩 렌더(presets 있을 때): 칩 클릭 → `setText(prompt)` 후 즉시 제출(기존 `submit` 로직 재사용; 이벤트 없이 호출 가능하도록 `submit`을 `(e?) => ...`로 약간 일반화).
- 히어로 배치를 위해 입력/버튼은 기존 그대로(레이아웃은 Hero에서 감쌈). 결과 그리드(RecommendationCard)·에러·빈결과 처리 모두 기존 유지.
- `HERO_PRESETS` 상수(Hero 또는 별도 `web/lib/home-presets.ts`):
  - { label: "🎯 비자 스폰서만", prompt: "비자 스폰서십 제공하는 백엔드 개발자 공고" }
  - { label: "🇩🇪 독일 백엔드", prompt: "독일 베를린 백엔드 개발자, 비자 스폰서 필요" }
  - { label: "🏠 원격 시니어", prompt: "원격 가능한 시니어 소프트웨어 엔지니어" }
  - { label: "🤖 AI/ML", prompt: "AI/ML 엔지니어, 비자 스폰서" }

### 4.3 `web/components/home/HeroStats.tsx` — 신규
- props: `{ stats: HomeStats }` where `HomeStats = { sponsors: number; total: number; companies: number; countries: number }`.
- 가로 수치 띠: **비자 스폰서 공고**(값 + 라벨, 초록 강조 `text-[--sponsor]` 또는 success 색) · 전체 공고 · 회사 · 국가. 각 값은 `toLocaleString()`.
- 0이거나 미상이면 해당 항목 숨김(안전).

### 4.4 `web/app/page.tsx` — 재구성
- 추가 fetch: 전체 공고 total(`fetchJobs({ pageSize: 1 })`), 회사 total(`fetchCompanies()` 의 `total`).
- `stats` 계산해 `<Hero regions stats />`에 전달.
- "나에게 맞는 공고" 섹션(SectionHeader + NlRecommend) 제거.
- 나머지 섹션(스폰서/국가별/새공고/회사) 유지. 비자 스폰서십 SectionHeader는 기존 `accent="visa"` 유지(초록 악센트).

## 5. 에러 처리 / 엣지
- stats fetch 실패 시 해당 수치 0/숨김(페이지는 정상 렌더). 기존 `Promise.all` + `.ok` 가드 패턴 유지.
- 프리셋 칩 클릭 시 입력 길이 maxLength(200) 내, 제출 중(loading)이면 중복 제출 방지(기존 abortRef 로직).
- NL 추천 결과 0건/429/네트워크 오류는 기존 메시지 그대로.
- 비로그인/로그인 무관(추천은 익명 가능, 기존과 동일).

## 6. 검증 (웹 기존 관행: 새 테스트 인프라 없음)
- `cd web && npx tsc --noEmit` 통과.
- **라이브 비주얼**(dev 스택 + Playwright): (a) 히어로에 NL 입력+프리셋 칩+수치 띠 표시, (b) 프리셋 칩 클릭 → 추천 결과 인페이지 렌더, (c) "나에게 맞는 공고" 별도 섹션 사라짐, (d) "직접 검색 →" 링크가 /search로, (e) 수치 띠가 실데이터(스폰서/전체/회사/국가)와 일치. 스크린샷.

## 7. 범위 밖 (YAGNI)
- 헤더 계정 드롭다운·모바일 햄버거(별도 스펙).
- 백엔드/추천 알고리즘/DB 변경.
- HeroSearch 파일 삭제(미사용이면 후속 정리).
- 디자인 토큰/테마 전면 개편.

## 8. 기대 효과
홈 첫 화면에서 자연어 한 문장(또는 칩 한 번)으로 맞춤 추천을 즉시 체험 → AI 추천이 주인공이 됨. 신뢰 수치로 규모·차별점(스폰서 명시) 전달. 중복 입력 제거로 더 명확. 백엔드 무변경이라 리스크 낮음.
