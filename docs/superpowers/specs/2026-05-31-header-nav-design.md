# 헤더 개선 — 계정 메뉴 드롭다운 + 모바일 햄버거 설계

> 작성일 2026-05-31. 전역 헤더(layout.tsx)를 반응형 + 계정 드롭다운으로 개선. 웹 전용. (홈 히어로 개선[PR #25]과 별개 후속.)

## 1. 배경과 목표

현재 헤더는 `layout.tsx`에 인라인된 평평한 링크 6개(검색/추천/회사/내 지원/소개 + `<UserMenu/>` + `<ThemeToggle/>`)다. 모바일에서 6개가 한 줄에 넘치고, 로그인 상태는 "로그아웃" 버튼만 평평하게 노출된다. 드롭다운/햄버거가 없다.

**목표:** (1) 로그인 시 계정 드롭다운(아바타 → 내 지원·로그아웃), (2) 모바일에서 nav를 햄버거 드롭다운으로 접기. 데스크톱 외형은 사실상 유지.

**비목표:** nav 항목별 하위 메뉴(시기상조), 백엔드/세션 변경, 디자인 시스템 개편. (세션엔 `userId`만 있어 사용자 이름 표시는 범위 밖 — 아바타/"내 계정" 사용.)

## 2. 핵심 결정 (브레인스토밍 확정)

1. **계정 드롭다운**: 비로그인 → "로그인" 링크(기존). 로그인 → 아바타 버튼 클릭 → 드롭다운(내 지원 `/me/applications`, 로그아웃). 로그아웃은 기존 `form action="/api/auth/logout" method="post"` 재사용. (세션에 이름 없음 → 아바타 원형 아이콘.)
2. **모바일 햄버거**: `< md` 에서 nav 링크 + 계정 + 테마를 ☰ 드롭다운 패널로. `≥ md` 는 현재 가로줄 유지.
3. **클라이언트 분리**: `layout.tsx`(서버)가 `getSession()`으로 `loggedIn` 판별 → 클라이언트 `SiteNav`에 prop 전달. 열림 상태·바깥클릭/Esc 닫기·aria 접근성은 클라이언트에서.
4. **웹 전용.** 백엔드/DB/세션 무변경.

## 3. 아키텍처 / 데이터 흐름

```
app/layout.tsx (서버)
  const session = await getSession()
  → <SiteNav loggedIn={!!session} />   (헤더 우측 전체 = nav + 계정 + 테마)

SiteNav (client)
  NAV_LINKS = [검색/추천/회사/내 지원/소개]
  데스크톱(md+): 가로 링크 + <AccountMenu loggedIn> + <ThemeToggle>   (hidden < md)
  모바일(< md): ☰ 버튼 → 드롭다운 패널(링크 + 계정 액션 + 테마)        (md:hidden)
  상태: mobileOpen; 바깥클릭/Esc 닫기; 링크 클릭 시 닫기

AccountMenu (client) { loggedIn }
  비로그인: <Link href="/signin">로그인</Link>   (기존 경로)
  로그인: 아바타 버튼 → 드롭다운(내 지원 링크 + 로그아웃 form). 바깥클릭/Esc 닫기, aria-expanded.
```

## 4. 컴포넌트 상세

### 4.1 `web/components/auth/AccountMenu.tsx` — 신규 (client)
- props: `{ loggedIn: boolean }`.
- 비로그인: `<Link href="/signin" className="hover:text-foreground transition-colors">로그인</Link>` (현 UserMenu와 동일 경로/스타일).
- 로그인: 원형 아바타 버튼(person 아이콘 또는 ● ; `aria-haspopup="menu"`, `aria-expanded`) → 클릭 토글 드롭다운:
  - 내 지원 → `<Link href="/me/applications">내 지원</Link>`
  - 로그아웃 → `<form action="/api/auth/logout" method="post"><button>로그아웃</button></form>` (기존 로직 재사용).
- 닫기: 바깥 클릭(useRef + document mousedown), Esc 키. 메뉴 항목 클릭 시 닫기.
- 드롭다운 패널: `absolute right-0 mt-2 ...` border/shadow/rounded(surface 색), 메뉴 role.

### 4.2 `web/components/SiteNav.tsx` — 신규 (client)
- props: `{ loggedIn: boolean }`.
- `const NAV_LINKS = [{href:"/search",label:"검색"},{href:"/recommend",label:"추천"},{href:"/companies",label:"회사"},{href:"/me/applications",label:"내 지원"},{href:"/about",label:"소개"}]`.
- **데스크톱**: `<div className="hidden md:flex items-center gap-3 ...">` 링크들 + `<AccountMenu loggedIn/>` + `<ThemeToggle/>`.
- **모바일**: `<div className="md:hidden ...">` 햄버거 버튼(☰, `aria-expanded`, `aria-controls`) → 토글 `mobileOpen`. 열리면 헤더 아래 드롭다운 패널(absolute, 전체 폭 또는 우측 정렬)에 NAV_LINKS + (loggedIn? 로그아웃 form : 로그인 링크) + 테마 토글 행.
- 닫기: 바깥 클릭·Esc·링크 클릭 시 `mobileOpen=false`. `next/navigation`의 경로 변경 시에도 닫힘(usePathname 효과) — 선택.

### 4.3 `web/app/layout.tsx` — 수정
- `import { getSession } from "@/lib/session-server";` + `import { SiteNav } from "@/components/SiteNav";`
- 컴포넌트를 async로(현재 RootLayout이 async인지 확인; 아니면 async화) — `const session = await getSession();`
- 헤더의 `<nav>...</nav>`(인라인 링크 + UserMenu + ThemeToggle) 전체를 `<SiteNav loggedIn={!!session} />`로 교체.
- `UserMenu`/`ThemeToggle` import는 layout에서 제거(ThemeToggle은 SiteNav가 사용). `UserMenu.tsx`는 AccountMenu로 대체되어 미사용 — 파일 삭제(완전 대체이고 작음) 또는 잔존(후속 정리). **삭제**한다(완전 대체, import도 layout에서만 쓰였음).

## 5. 에러 처리 / 엣지
- SSR/CSR: SiteNav는 client. layout는 server에서 세션 읽어 loggedIn만 내려줌(민감정보 없음).
- 드롭다운 열린 채 라우팅 → 닫힘 처리.
- 키보드: 버튼 포커스/Esc 닫기, aria-expanded 갱신. (메뉴 항목 화살표 네비게이션은 범위 밖 — 기본 탭 순서.)
- 모바일 패널 열림 시 본문 스크롤은 그대로(오버레이 없이 드롭다운). 바깥 클릭으로 닫힘.
- `getSession`이 RootLayout을 동적으로 만들 수 있음(cookies() 사용) — 기존에도 인증 쿠키 사용하므로 허용. (필요 시 헤더만 별도 처리 불필요.)

## 6. 검증 (웹 기존 관행: 새 테스트 인프라 없음)
- `cd web && npx tsc --noEmit` 통과.
- **라이브 비주얼**(dev 스택 + Playwright):
  - 데스크톱 폭: 가로 nav 유지, 비로그인 시 "로그인" 노출.
  - 모바일 폭(browser_resize ~375): nav 링크가 ☰로 접힘 → ☰ 클릭 시 드롭다운 패널에 링크/계정/테마 표시 → 바깥 클릭 닫힘.
  - (로그인 상태 검증은 세션 쿠키 필요 — 가능하면 확인, 어려우면 비로그인 경로 + 코드 리뷰로 갈음.)
  - 스크린샷.

## 7. 범위 밖 (YAGNI)
- nav 항목별 하위 메뉴.
- 사용자 이름/프로필 표시(세션에 없음; 별도 /me fetch 불필요).
- 백엔드/세션/디자인 토큰 변경.
- 모바일 슬라이드 시트(드롭다운 패널로 충분).

## 8. 기대 효과
모바일에서 헤더가 깔끔히 접히고, 로그인 사용자는 표준 계정 드롭다운으로 내 지원·로그아웃 접근. 전역 레이아웃 한 곳 수정으로 모든 페이지 적용. 백엔드 무변경.
