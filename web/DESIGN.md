---
name: dev-jobs Design System
version: 0.2.0
style: toss-influenced-fintech-korean
inspiration: [Toss, Korean fintech/consumer services]
color_schemes: [light, dark]
fonts:
  sans: "var(--font-hanken), Hanken Grotesk, Pretendard Variable, Pretendard, Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
  mono: "JetBrains Mono, SFMono-Regular, Menlo, Consolas, monospace"
  serif: "var(--font-serif), Noto Serif KR, Nanum Myeongjo, serif"
colors:
  light:
    background: "#ffffff"
    surface: "#ffffff"
    surface-2: "#f2f4f6"
    foreground: "#191f28"
    muted-foreground: "#4e5968"
    hint: "#677079"
    border: "#e5e8eb"
    input: "#e5e8eb"
    primary: "#0064ff"
    primary-foreground: "#ffffff"
    primary-tint: "#eef4ff"
    logo: "#c2c6d8"
    ring: "#0064ff"
    accent: "#f2f4f6"
    success: "#15803d"
    warning: "#b45309"
    destructive: "#e0301e"
    verified: "#a16207"
    verified-foreground: "#ffffff"
    section-muted: "#f9fafb"
  dark:
    background: "#16191f"
    surface: "#1c2026"
    surface-2: "#262b33"
    foreground: "#f2f4f6"
    muted-foreground: "#9aa3af"
    hint: "#7c8694"
    border: "#2c323b"
    input: "#2c323b"
    primary: "#3d83ff"
    primary-foreground: "#ffffff"
    primary-tint: "rgba(61, 131, 255, 0.16)"
    logo: "#3a4150"
    ring: "#3d83ff"
    accent: "#262b33"
    success: "#2bb673"
    warning: "#f59e0b"
    destructive: "#ef4444"
    verified: "#eab308"
    verified-foreground: "#09090b"
    section-muted: "#1a1e24"
domain_tokens:
  visa:
    sponsors: success
    no_sponsor: destructive
    unclear: muted-foreground
  score:
    stack: "#0064ff"
    location: "#0ea5e9"
    seniority: "#8b5cf6"
    salary: "#f59e0b"
    semantic: "#f43f5e"
    visa: "#10b981" # legacy, 비자는 매칭 축이 아님 — 하위호환용(미사용)
typography:
  display:    { size: "3.5rem",    weight: 800, line_height: "1.1", tracking: "-0.04em" }
  display-sm: { size: "2.75rem",   weight: 800, line_height: "1.1", tracking: "-0.035em" }
  h1:         { size: "2rem",      weight: 700, line_height: "1.3", tracking: "-0.03em" }
  h2:         { size: "1.5rem",    weight: 700, line_height: "1.4", tracking: "-0.02em" }
  h3:         { size: "1.25rem",   weight: 600, line_height: "1.5", tracking: "-0.01em" }
  body-lg:    { size: "1.0625rem", weight: 400, line_height: "1.6", tracking: "-0.01em" }
  body:       { size: "0.9375rem", weight: 400, line_height: "1.6" }
  body-sm:    { size: "0.875rem",  weight: 400, line_height: "1.5" }
  label:      { size: "0.8125rem", weight: 600, line_height: "1.4", tracking: "0.01em" }
  caption:    { size: "0.75rem",   weight: 400, line_height: "1.4" }
  mono:       { size: "0.8125rem", weight: 400, line_height: "1.5" }
spacing:
  base: 4
  scale_rem: [0, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 12]
radius:
  sm: "0.25rem"
  DEFAULT: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.5rem"
  2xl: "1.5rem"
  full: "9999px"
  base: "1rem" # --radius CSS 변수 기본값
shadow:
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.04)"
  md: "0 4px 20px rgba(0, 0, 0, 0.04)"
  lg: "0 12px 32px rgba(0, 0, 0, 0.08)"
gradients:
  hero_light: "linear-gradient(125deg, #f5f3ff 0%, #faf5ff 35%, #ffffff 80%)"
  hero_dark: "radial-gradient(60% 80% at 50% 0%, rgba(99,102,241,0.12), transparent 70%), #09090b"
breakpoints:
  sm: "640px"
  md: "768px"
  lg: "1024px"
  xl: "1280px"
container:
  max_width: "1200px"
---

# dev-jobs Design System

> README.md 가 코드 구조를 설명하듯, 이 파일은 **시각 시스템**을 정의한다. AI 코딩 에이전트(Claude Code 등)가 컴포넌트를 만들 때 이 토큰만 쓰고 임의의 색·간격을 쓰지 않도록 하는 single source of truth.
>
> 포맷은 Google Stitch 의 DESIGN.md 스펙을 따른다 (YAML front matter = 기계 판독 토큰, 본문 = 사람용 근거).
>
> **v0.2.0 (2026-06-27 재기준화):** 이 문서는 한동안 v0.1.0 초안(친근한 한국형 서비스, primary `#2b6cf0`)에 머물러 있었고 실제 구현(`globals.css`/`tailwind.config.ts`)이 "Toss풍 Global Talent System"으로 앞서 나가 있었다. 디자인 QA 에서 드리프트가 확인되어, **구현을 정본으로 삼아 문서를 일치**시켰다. 값의 정본은 항상 `app/globals.css`(색)·`tailwind.config.ts`(타이포/radius/shadow/폰트)다.

## 디자인 원칙

1. **토스풍 핀테크 톤** — 밝은 흰 배경, 견고한 squircle 라운드(표준 요소 16px·컨테이너/카드 24px), 단일 파랑 액센트(`#0064ff`). 그라데이션은 Hero 등 제한된 곳에서만, 색은 의미를 가질 때만.
2. **정보 밀도 우선** — 채용 사이트는 한 화면에 많은 공고를 비교한다. 여백보다 스캔 가능성.
3. **의미론적 색상** — 색은 장식이 아니라 신호. 비자 상태(녹/적/회), 점수 차원(5색)처럼 정보를 색으로 전달.
4. **라이트/다크 동등** — 개발자 타겟이라 다크모드는 1급 시민. 모든 토큰을 두 스킴으로 정의.

## Color

- **Neutral (Toss 그레이 계열)**: background / surface / surface-2 / border / foreground / muted-foreground / `hint` 가 거의 모든 화면을 채운다. `hint` 는 가장 약한 보조 텍스트(플레이스홀더 톤).
- **Primary (파랑 단색, `#0064ff` 라이트 / `#3d83ff` 다크)**: 그라데이션 없는 단색. 액션(버튼, 링크, 포커스 ring)에만. `primary-tint`(`#eef4ff` 라이트 / 반투명 다크)는 선택 배경·연한 강조 tint 전용.
- **Semantic**:
  - `success` (green) — 비자 sponsors, 긍정 신호
  - `destructive` (red) — 비자 no_sponsor, 위험
  - `warning` (amber) — 주의, 낮은 disclosure
  - `verified` (gold) — 명부 대조 검증 신호 전용(랜딩 신뢰 pill·권위 통계). `warning`(낮은 disclosure 주의)과 의미·색조 분리. `verified-foreground` 는 그 위 텍스트색.
  - `muted-foreground` — 비자 unclear, 보조 텍스트
- **Score 5색** — 추천 점수 분해 차트(recharts) 전용. stack/location/seniority/salary/semantic 을 구분되는 hue 로. (`score-visa` 는 하위호환용 legacy 토큰, 현재 미사용)
- **보조 토큰**: `logo`(로고 워드마크 그레이), `section-muted`(랜딩 전폭 섹션 교차 배경).

라이트는 흰 배경 + 진한 텍스트, 다크는 `#16191f` 배경 + `#1c2026` surface. 다크에서 primary 를 한 단계 밝게(`#0064ff`→`#3d83ff`) 해 대비 확보.

## Typography

- **Hanken Grotesk** (영문/숫자, 핀테크 톤 — `--font-hanken`) + **Pretendard** (한글 UI) + **JetBrains Mono** (job_id, 코드, 연봉 숫자).
- **Noto Serif KR** (serif/명조 — `--font-serif`) — 신뢰 강조 헤드라인 구절 전용(권위 톤). 본문/UI/숫자에는 쓰지 않는다.
- scale 은 display → caption 의 본문/제목 단계 + label + mono (총 11단계). 큰 제목일수록 음수 letter-spacing(tracking)으로 조인다(헤드라인 -0.02 ~ -0.04em).
- 본문 line-height 1.6 (한글 가독성), 제목은 1.1~1.5.

## Spacing & Layout

- 4px 기반 scale (Tailwind 기본과 일치).
- 컨테이너 max-width 1200px (`max-w-container`), 좌우 패딩 16px.
- 카드 내부 패딩 24px (`p-6`), 카드 간격 16px.

## Radius & Shadow

- radius 토큰: `sm` 4px / 기본 8px / `md` 12px / `lg` 16px / `xl`·`2xl` 24px / `full`. CSS `--radius` 기본값 16px.
- 표준 요소 `lg`(16px), 컨테이너·앱 카드 `xl`/`2xl`(24px), badge/pill `full`.
- shadow 는 초연성(ambient) 소프트 섀도우 — `sm` 미세 / `md` hover·active / `lg` modal·overlay. 다크는 그림자보다 border 로 면을 구분.

## Components

### Button
- variants: `primary`(파랑 bg) / `secondary`(surface-2 bg) / `ghost`(투명, hover 시 accent) / `outline`(border) / `destructive`(red) / `link`(밑줄 링크).
- sizes: `sm`(h-12, 48px 최소 터치 타깃) / `md`(h-[52px], 52px 표준) / `lg`·`xl`(h-14, 56px CTA) / `icon`(48×48). radius `lg`(16px squircle). 포커스 시 `ring` 2px. 220ms 스냅 트랜지션, `text-body-sm` `font-bold`.
- 주의: `size` 에는 색/폰트 클래스를 넣지 않는다(tailwind-merge 가 variant 의 글자색을 같은 `text-*` 그룹으로 보고 지움).

### Card
- bg `surface`, border 1px `border`, radius `2xl`(24px), padding `p-6`, shadow `sm`(라이트).
- 공고 리스트의 JobCard 가 핵심 반복 단위.

### Badge (VisaBadge)
- `sponsors`: success 색 텍스트 + success 10% 배경 tint.
- `no_sponsor`: destructive 텍스트 + tint.
- `unclear`: muted-foreground + surface-2 배경.
- radius `full`, 작은 caption 타이포.

### Input
- border `input`, radius `lg`, 포커스 시 `ring`.
- 검색 바는 상단 고정, mono placeholder("python backend").

### ScoreBreakdownBars
- recharts 가로 막대. 5차원 각각 `domain_tokens.score` 색.
- 0~1 점수를 0~100% 폭으로.

## 랜딩 페이지 컴포넌트

> `/`(메인)를 큐레이션형 랜딩으로 전환하며 추가된 재사용 컴포넌트. 기능/데이터 흐름은 `../docs/superpowers/specs/2026-05-24-main-landing-page-design.md` 참고. 톤은 "하이브리드" — 기존 미니멀 유지 + Hero 그라데이션 + 의미색 강조만.

### Hero
- 풀폭 배너. 배경 `gradients.hero_light`(라이트) / `gradients.hero_dark`(다크). 중앙 정렬.
- `display` 타이포 헤드라인(핵심어만 `primary`) + `body` 보조 카피 + 큰 검색 입력(우측 `primary` 버튼) + 빠른 필터칩(`pill`).
- 검색/칩 → `/search?...` 이동.

### SectionHeader
- 섹션 제목(`h2`) + 좌측 의미색 점(옵션) + 우측 "전체 보기" 링크(`primary`, `body-sm`).
- 의미색 점은 신호로만: 비자 섹션 = `success`(green), 추천 섹션 = `primary`.

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
| `colors.light/dark` | `globals.css` 의 `:root` / `.dark` CSS 변수 (← 색의 정본) |
| `fonts`, `radius`, `typography`, `shadow` | `tailwind.config.ts` 의 `theme.extend` (← 스케일의 정본) |
| `domain_tokens.score` | recharts 차트 색 배열 (컴포넌트에서 import) |
| `components` | `components/ui/*` (shadcn) + 도메인 컴포넌트 |

CSS 변수는 shadcn/ui 컨벤션(`--background`, `--foreground`, `--primary`, `--border`, `--ring`, `--destructive` 등)을 따른다. **문서와 구현이 어긋나면 구현(`globals.css`/`tailwind.config.ts`)이 정본이며, 이 문서를 구현에 맞춰 갱신한다** — 반대로 하지 않는다(출시 중 화면이 바뀌므로).

## 참고

- Stitch DESIGN.md 스펙: https://github.com/google-labs-code/design.md
- 이 파일은 사이트 아키텍처 문서(`../DESIGN.md`)와 별개 — 그건 "무엇을/어떻게 만드는가", 이건 "어떻게 생겼는가".
