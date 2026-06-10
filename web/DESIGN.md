---
name: dev-jobs Design System
version: 0.1.0
style: friendly-korean-service
inspiration: [generic Korean consumer services]
color_schemes: [light, dark]
fonts:
  sans: "Pretendard Variable, Pretendard, Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
  mono: "JetBrains Mono, SFMono-Regular, Menlo, Consolas, monospace"
  serif: "Noto Serif KR, Nanum Myeongjo, serif"
colors:
  light:
    background: "#ffffff"
    surface: "#ffffff"
    surface-2: "#f3f4f6"
    foreground: "#111827"
    muted-foreground: "#6b7280"
    border: "#e5e7eb"
    input: "#e5e7eb"
    primary: "#2b6cf0"
    primary-foreground: "#ffffff"
    ring: "#2b6cf0"
    accent: "#f3f4f6"
    success: "#16a34a"
    warning: "#d97706"
    destructive: "#dc2626"
    verified: "#ca8a04"
  dark:
    background: "#111418"
    surface: "#1a1f26"
    surface-2: "#232a33"
    foreground: "#f5f7fa"
    muted-foreground: "#9aa4b2"
    border: "#2a313b"
    input: "#2a313b"
    primary: "#5b8df5"
    primary-foreground: "#ffffff"
    ring: "#5b8df5"
    accent: "#232a33"
    success: "#22c55e"
    warning: "#f59e0b"
    destructive: "#ef4444"
    verified: "#eab308"
domain_tokens:
  visa:
    sponsors: success
    no_sponsor: destructive
    unclear: muted-foreground
  score:
    stack: "#6366f1"
    visa: "#10b981"
    location: "#0ea5e9"
    seniority: "#8b5cf6"
    salary: "#f59e0b"
    semantic: "#f43f5e"
typography:
  display: { size: "2.25rem", weight: 700, line_height: "1.1", tracking: "-0.02em" }
  h1:      { size: "1.875rem", weight: 700, line_height: "1.2", tracking: "-0.02em" }
  h2:      { size: "1.5rem", weight: 600, line_height: "1.3", tracking: "-0.01em" }
  h3:      { size: "1.25rem", weight: 600, line_height: "1.4" }
  body:    { size: "1rem", weight: 400, line_height: "1.6" }
  body-sm: { size: "0.875rem", weight: 400, line_height: "1.5" }
  caption: { size: "0.75rem", weight: 400, line_height: "1.4" }
  mono:    { size: "0.8125rem", weight: 400, line_height: "1.5" }
spacing:
  base: 4
  scale_rem: [0, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 12]
radius:
  sm: "0.25rem"
  md: "0.375rem"
  lg: "0.5rem"
  xl: "0.75rem"
  full: "9999px"
shadow:
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)"
  md: "0 2px 8px -1px rgb(0 0 0 / 0.08)"
  lg: "0 8px 24px -4px rgb(0 0 0 / 0.12)"
gradients:
  hero_light: "linear-gradient(125deg, #f5f3ff 0%, #faf5ff 35%, #ffffff 80%)"
  hero_dark: "radial-gradient(60% 80% at 50% 0%, rgba(99,102,241,0.12), transparent 70%), #09090b"
breakpoints:
  sm: "640px"
  md: "768px"
  lg: "1024px"
  xl: "1280px"
container:
  max_width: "1152px"
---

# dev-jobs Design System

> README.md 가 코드 구조를 설명하듯, 이 파일은 **시각 시스템**을 정의한다. AI 코딩 에이전트(Claude Code 등)가 컴포넌트를 만들 때 이 토큰만 쓰고 임의의 색·간격을 쓰지 않도록 하는 single source of truth.
>
> 포맷은 Google Stitch 의 DESIGN.md 스펙을 따른다 (YAML front matter = 기계 판독 토큰, 본문 = 사람용 근거).

## 디자인 원칙

1. **친근한 한국형 서비스** — 밝은 흰 배경, 부드러운 라운드(카드 14px), 단일 파랑 액센트(#2b6cf0). 그라데이션·장식 금지, 색은 의미를 가질 때만.
2. **정보 밀도 우선** — 채용 사이트는 한 화면에 많은 공고를 비교한다. 여백보다 스캔 가능성.
3. **의미론적 색상** — 색은 장식이 아니라 신호. 비자 상태(녹/적/회), 점수 차원(6색)처럼 정보를 색으로 전달.
4. **라이트/다크 동등** — 개발자 타겟이라 다크모드는 1급 시민. 모든 토큰을 두 스킴으로 정의.

## Color

- **Neutral (zinc 계열)**: background / surface / border / foreground / muted-foreground 가 거의 모든 화면을 채운다.
- **Primary (파랑 단색, #2b6cf0 라이트 / #5b8df5 다크)**: indigo→파랑 단색으로 전환, 그라데이션 금지. 액션(버튼, 링크, 포커스 ring)에만. 남발하면 미니멀이 깨진다.
- **Semantic**:
  - `success` (green) — 비자 sponsors, 긍정 신호
  - `destructive` (red) — 비자 no_sponsor, 위험
  - `warning` (amber) — 주의, 낮은 disclosure
  - `verified` (gold) — 명부 대조 검증 신호 전용(랜딩 신뢰 pill·권위 통계). `warning`(낮은 disclosure 주의)과 의미·색조 분리.
  - `muted-foreground` — 비자 unclear, 보조 텍스트
- **Score 6색** — 추천 점수 분해 차트(recharts) 전용. stack/visa/location/seniority/salary/semantic 을 구분되는 hue 로.

라이트는 흰 배경 + 진한 텍스트, 다크는 zinc-950 배경 + zinc-900 surface. 다크에서 primary 를 한 단계 밝게(indigo-600→500) 해 대비 확보.

## Typography

- **Pretendard** (한글 UI) + **Inter** (영문/숫자) + **JetBrains Mono** (job_id, 코드, 연봉 숫자).
- **Noto Serif KR** (serif/명조) — 신뢰 강조 헤드라인 구절 전용(SponsorMap식 권위 톤). 본문/UI/숫자에는 쓰지 않는다.
- scale 은 display → caption 7단계 + mono. 큰 제목일수록 음수 letter-spacing(tracking)으로 조인다.
- 본문 line-height 1.6 (한글 가독성), 제목은 1.1~1.4.

## Spacing & Layout

- 4px 기반 scale (Tailwind 기본과 일치).
- 컨테이너 max-width 1152px (`max-w-6xl`), 좌우 패딩 16px.
- 카드 내부 패딩 24px (`p-6`), 카드 간격 16px.

## Radius & Shadow

- radius 기본 `md`(6px), 카드 `lg`(8px), badge/pill `full`.
- shadow 는 **라이트에서만** 약하게. 다크는 그림자 대신 border 로 면을 구분 (Linear 방식).

## Components

### Button
- variants: `primary`(indigo bg) / `secondary`(surface-2 bg) / `ghost`(투명, hover 시 accent) / `destructive`(red).
- sizes: `sm`(h-8) / `md`(h-9) / `lg`(h-10). radius `md`. 포커스 시 `ring` 2px.

### Card
- bg `surface`, border 1px `border`, radius `lg`, padding `p-6`, shadow `sm`(라이트).
- 공고 리스트의 JobCard 가 핵심 반복 단위.

### Badge (VisaBadge)
- `sponsors`: success 색 텍스트 + success 10% 배경 tint.
- `no_sponsor`: destructive 텍스트 + tint.
- `unclear`: muted-foreground + surface-2 배경.
- radius `full`, 작은 caption 타이포.

### Input
- border `input`, radius `md`, 포커스 시 `ring`.
- 검색 바는 상단 고정, mono placeholder("python backend").

### ScoreBreakdownBars
- recharts 가로 막대. 6차원 각각 `domain_tokens.score` 색.
- 0~1 점수를 0~100% 폭으로.

## 랜딩 페이지 컴포넌트

> `/`(메인)를 큐레이션형 랜딩으로 전환하며 추가된 재사용 컴포넌트. 기능/데이터 흐름은 `../docs/superpowers/specs/2026-05-24-main-landing-page-design.md` 참고. 톤은 "하이브리드" — 기존 미니멀 유지 + Hero 그라데이션 + 의미색 강조만.

### Hero
- 풀폭 배너. 배경 `gradients.hero_light`(라이트) / `gradients.hero_dark`(다크). 중앙 정렬.
- `display` 타이포 헤드라인(핵심어만 `primary` indigo) + `body` 보조 카피 + 큰 검색 입력(우측 `primary` 버튼) + 빠른 필터칩(`pill`).
- 검색/칩 → `/search?...` 이동.

### SectionHeader
- 섹션 제목(`h2`) + 좌측 의미색 점(옵션) + 우측 "전체 보기" 링크(`primary`, `body-sm`).
- 의미색 점은 신호로만: 비자 섹션 = `success`(green), 추천 섹션 = `primary`(indigo).

### JobScrollRow
- `JobCard` 를 가로 스크롤(overflow-x, 모바일 스와이프). 카드 min-width 고정.
- 비자 스폰서십·신규 공고 행에 사용.

### CountryTile
- 국가 바로가기 타일. `surface-2` 배경, radius `lg`. 국가명 + 도시 보조(`caption`).
- 클릭 → `/search?location=...`.

### CompanySpotlight
- 회사 카드 그리드. 로고 자리(이니셜 박스, `accent` 배경 + `primary` 글자) + 회사명 + 공고 수(`caption`).
- 클릭 → `/companies/[slug]`.

### NlRecommend (클라이언트)
- 자연어 한 문장 입력 + "추천 받기" 버튼. 결과는 `RecommendationCard` + `ScoreBreakdownBars` 재사용.
- 상태: 미입력(입력창+예시) / 로딩(스켈레톤) / 결과 / 에러(섹션 내 안내). 마지막 입력 `localStorage` 기억.

## 구현 매핑

| DESIGN.md 토큰 | 구현 위치 |
|---|---|
| `colors.light/dark` | `globals.css` 의 `:root` / `.dark` CSS 변수 |
| `fonts`, `radius`, `typography`, `colors` | `tailwind.config.ts` 의 `theme.extend` |
| `domain_tokens.score` | recharts 차트 색 배열 (컴포넌트에서 import) |
| `components` | `components/ui/*` (shadcn) + 도메인 컴포넌트 |

CSS 변수는 shadcn/ui 컨벤션(`--background`, `--foreground`, `--primary`, `--border`, `--ring`, `--muted`, `--destructive` 등)을 따르므로, 추후 `npx shadcn@latest init` 시 그대로 호환된다.

## 참고

- Stitch DESIGN.md 스펙: https://github.com/google-labs-code/design.md
- 이 파일은 사이트 아키텍처 문서(`../DESIGN.md`)와 별개 — 그건 "무엇을/어떻게 만드는가", 이건 "어떻게 생겼는가".
