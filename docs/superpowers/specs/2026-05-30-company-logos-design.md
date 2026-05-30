# 공고 카드 회사 로고 표시 설계

> 작성일 2026-05-30. 각 공고에 회사 로고를 표시. 웹 전용(백엔드/DB/ETL 무변경).

## 1. 배경과 목표

공고 카드(`JobCard`)는 현재 회사명을 텍스트로만 보여준다. 각 공고에 회사 로고를 붙여 시각적 식별성을 높인다. 웹 클라이언트는 이미 `job.company.slug`와 `display_name`을 갖고 있어(백엔드 응답 스키마), 백엔드/DB/ETL 변경 없이 클라이언트에서 로고를 끌어올 수 있다.

**목표:** 모든 공고 카드에 회사 로고를 표시하고, 가져오지 못하면 이니셜 아바타로 폴백(깨진 이미지 없음).

**비목표:** 백엔드/DB/ETL/companies.json 변경, 로고 서버 저장·프록시·캐싱, 회사 도메인 대량 큐레이션, next/image 최적화.

## 2. 핵심 결정 (브레인스토밍 확정)

1. **전략 = 웹 전용, slug→도메인 추론.** `company.slug`(ATS 토큰, 대개 도메인 루트)로 `{slug}.com`을 추론. 눈에 띄는 불일치는 작은 override 맵으로 보정. 백엔드/DB/ETL 변경 0.
2. **로고 소스 = DuckDuckGo favicon** (`https://icons.duckduckgo.com/ip3/{domain}.ico`). 토큰·계정 불필요, 테스트에서 200·직접 이미지 확인됨. (Clearbit은 2026 응답 없음, Logo.dev는 토큰 필요·무료티어 한도/표기.) **로고 URL 생성은 단일 함수로 캡슐화** → 추후 Logo.dev 토큰 받으면 그 함수 1줄 교체로 업그레이드.
3. **폴백 = 이니셜 아바타.** favicon 실패/slug 없음 시 display_name 첫 1–2글자 + 이름 해시 기반 배경색(회사마다 일관). 항상 무언가 보임.
4. **이미지 태그 = 일반 `<img>`** (next/image 아님) → `next.config` remotePatterns 설정 불필요.

## 3. 아키텍처 / 데이터 흐름

```
JobCard / RecommendationCard / 공고 상세
   │ job.company {slug, display_name}
   ▼
<CompanyLogo slug={...} name={display_name} size={36} />
   │ slugToDomain(slug) → "{slug}.com" (+ DOMAIN_OVERRIDES)
   ▼ logoUrl(domain) → "https://icons.duckduckgo.com/ip3/{domain}.ico"
 <img src loading="lazy" onError=폴백>
   │ 실패/ slug 없음
   ▼ 이니셜 아바타 (initials(name) + colorFromName(name))
```

## 4. 컴포넌트 상세

### 4.1 `web/lib/logo.ts` — 신규 (순수 함수, 부수효과 없음)
- `slugToDomain(slug: string): string` — `slug`를 소문자/trim 후 override 우선, 없으면 `${slug}.com`. 빈 slug면 빈 문자열.
  - `DOMAIN_OVERRIDES: Record<string,string>` — 눈에 띄는 불일치만(예: `scaleai: "scale.com"`, `cockroachlabs: "cockroachlabs.com"`은 기본과 동일하니 불필요; 실제 불일치만). 초기 소수만, 확장 가능.
- `logoUrl(domain: string): string` — `https://icons.duckduckgo.com/ip3/${domain}.ico`. **소스 교체 단일 지점.** 빈 domain이면 빈 문자열.
- `initials(name: string): string` — display_name에서 첫 1–2 단어 이니셜(대문자, 최대 2자).
- `colorFromName(name: string): string` — 이름 해시 → 고정 팔레트 중 하나(Tailwind 호환 클래스 또는 hsl). 회사마다 일관된 배경색.

### 4.2 `web/components/company/CompanyLogo.tsx` — 신규
- Props: `{ slug?: string; name: string; size?: number }` (size 기본 36).
- 상태: `failed`(이미지 로드 실패) — `useState(false)`.
- slug 있고 `!failed`면 `<img src={logoUrl(slugToDomain(slug))} alt={name} width=size height=size loading="lazy" onError={()=>setFailed(true)} className="rounded-md object-contain bg-muted ..." />`.
- 그 외엔 이니셜 아바타: 원형/둥근 사각 div에 `initials(name)`, 배경 `colorFromName(name)`, 고정 size.
- 레이아웃 시프트 방지: 컨테이너 고정 `width/height = size`, `shrink-0`.

### 4.3 `web/components/job/JobCard.tsx` — 수정
CardHeader의 제목/회사 블록 좌측에 `<CompanyLogo slug={job.company.slug} name={job.company.display_name} />`를 `flex items-start gap-3`로 배치. 기존 VisaBadge·제목·메타 구조 유지.

### 4.4 `web/components/recommend/RecommendationCard.tsx` + `web/app/jobs/[id]/page.tsx` — 수정
동일 `<CompanyLogo>` 재사용. 추천 카드와 상세 헤더에 회사 로고 표시. (같은 컴포넌트라 추가 비용 적음.)

## 5. 에러 처리 / 엣지

- favicon 404/네트워크 실패 → `onError` → 이니셜 아바타.
- `slug` 없음/빈/undefined → 즉시 이니셜.
- 자유텍스트 잡보드 회사(slug=슬러그화된 이름) → 도메인 추측 빗나가면 favicon 실패 → 이니셜(graceful).
- 로딩 중 → `bg-muted` placeholder(고정 크기)로 시프트 없음.
- `name` 비어도 이니셜은 "?" 등 안전 기본값.

## 6. 검증 (웹 기존 관행: 새 테스트 인프라 없음)

웹에 테스트 러너·기존 테스트가 없으므로 새 인프라(vitest)를 도입하지 않는다.
- `slugToDomain`/`logoUrl`/`initials`/`colorFromName`은 순수·단순 함수로 자명하게 정확하게 작성.
- `cd web && npx tsc --noEmit` 타입체크 통과.
- **라이브 비주얼 검증**(dev 스택 + Playwright): /search·홈·공고상세에서 로고 정상 표시, 실패 케이스 이니셜 폴백, 레이아웃 시프트 없음 스크린샷.
- (선택, 범위 밖) 추후 vitest 도입 시 순수함수 유닛테스트.

## 7. 범위 밖 (YAGNI)

- 백엔드/DB/ETL/companies.json 변경.
- 로고 서버 저장·프록시·캐싱.
- Logo.dev 토큰(후속 `logoUrl` 1줄 교체로 가능하게만 설계).
- 회사 도메인 대량 큐레이션(override는 눈에 띄는 불일치 몇 개만).
- next/image·remotePatterns.

## 8. 기대 효과

모든 공고 카드·추천 카드·상세 헤더에 회사 로고(favicon) 표시, 실패 시 이니셜 아바타로 항상 깔끔. 백엔드 무변경이라 리스크 낮고 빠르게 적용. 로고 품질 업그레이드는 추후 `logoUrl` 한 함수 교체로 가능.
