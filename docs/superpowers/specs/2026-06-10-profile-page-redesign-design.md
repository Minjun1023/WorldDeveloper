# 프로필 페이지 재디자인 — 설계

- 날짜: 2026-06-10
- 상태: 승인됨 (구현 계획 작성 대기)
- 브랜치: `feat/ui-restructure`
- 관련: [design-revamp-readdy 메모], `docs/readdy-redesign-prompts.md` [7] 마이페이지

## 배경

진행 중인 Readdy 기반 UI 개편의 일환. `/me/profile`은 현재 가장 미완성 화면으로,
제목 + `ProfileForm`(쉼표 구분 텍스트 입력 6개)을 단일 카드에 나열한 형태다.
또한 마이페이지 영역(`/me/saved`, `/me/applications`, `/me/profile`, `/me/coach`)에는
공통 내비가 없어 화면들이 따로 떠 있다.

핵심 발견: 세션에는 `userId`만 있고 이름·이메일·아바타 같은 신원 데이터가 없다
(`web/lib/session.ts` `Session { userId: string }`). 따라서 이 "프로필"은 계정 프로필이
아니라 **추천을 위한 선호조건 프로필**(`RecommendProfile`)이다. 재디자인의 중심은
"선호조건을 채우면 → 추천에 이렇게 반영된다"를 분명히 보여주는 것이다.

## 확정된 결정 (브레인스토밍)

1. **범위 = 마이페이지 영역 전체.** 공통 쉘을 만들고 그 안의 프로필 탭을 재디자인.
   단, 새 라우트는 만들지 않고 기존 4개 라우트만 사용.
2. **공통 내비 = 좌측 사이드바** (데스크톱), 모바일은 상단 가로 스크롤 탭으로 접힘.
3. **프로필 탭 레이아웃 = 폼 + 실시간 미리보기 2단.**
4. **미리보기 깊이 = 6차원 매핑(즉시) + 온디맨드 매칭수.** 키 입력마다 호출 X.
5. **필드 = 기존 6개 + 자기소개(bio).** 비자 토글·제외 회사는 추가하지 않음.
   비자 스폰서십은 기본 ON 유지(안내 문구만).
6. **공유 `ProfileForm`은 변경하지 않는다.** 프로필 전용 리치 폼을 새로 만들어 재디자인을
   격리한다. (`ProfileForm`은 onboarding/recommend/auth가 공유하고 테스트가 라벨/쉼표
   입력에 의존하므로 건드리면 다른 화면이 깨진다.)

## 아키텍처

### 마이페이지 공통 쉘

- **신규** `web/app/(main)/me/layout.tsx`
  - 좌측 `MeSidebar` + 우측 콘텐츠 영역(기존 `max-w` 컨테이너).
  - 데스크톱(lg+): 사이드바 고정 컬럼. 모바일: 사이드바를 숨기고 콘텐츠 상단에 가로
    스크롤 탭 노출.
  - 이 layout이 `me/*` 모든 페이지를 감싸므로, 기존 saved/applications/coach 페이지의
    바깥 `max-w` 래퍼는 쉘로 흡수해 중복을 제거한다. 각 페이지의 콘텐츠/제목(`h1`)은
    그대로 둔다 — 시각 변화는 사이드바가 붙는 것뿐.
- **신규** `web/components/me/MeSidebar.tsx`
  - 항목(순서): 프로필 `/me/profile`, 저장한 공고 `/me/saved`, 지원 현황
    `/me/applications`, 이력서 코치 `/me/coach`.
  - 각 항목: lucide 아이콘 + 라벨. `usePathname()`으로 active 표시(보라 강조).
  - 회복 경로(recovery)는 현재 `/me/applications` 안의 `RecoveryPanel`이라 별도 항목으로
    만들지 않는다.

### 프로필 탭 — 폼 (좌측)

- **신규** `web/components/profile/ProfileFields.tsx` (리치 입력 위젯).
- **완성도 바**: 사용자가 직접 채우는 5개 항목(기술스택·연차·선호지역·연봉·bio) 중 채운 수를
  `n / 5`로 표시(tabular-nums) + 진행 바(보라 그라데이션). 시니어리티·원격선호는 항상 기본값이
  있어(senior/any) 완성도 카운트에서 제외 — 빈 프로필이 인위적으로 채워져 보이지 않게 한다.
- 섹션 카드 2개:
  - **기술 · 경력**
    - 기술 스택: 태그칩 입력(Enter/쉼표로 칩 추가, ✕로 제거). 내부 모델은
      `skills: string[]` 유지.
    - 시니어리티: 세그먼트 컨트롤 5단(junior/mid/senior/staff/principal).
    - 연차: 숫자 입력(선택).
    - 자기소개(bio): textarea. "의미 매칭에 사용" 힌트. `RecommendProfile.bio`에 매핑.
  - **선호 근무조건**
    - 선호 지역: 칩 입력(자유 입력, 칩으로 관리). `preferred_locations: string[]`.
    - 원격/이주: 세그먼트 3단(상관없음/원격/이주) → `remote_preference` (any/remote/onsite).
    - 희망 연봉: 슬라이더 + `${k}` 표시(tabular-nums). `desired_salary_usd`.
    - 안내: "🛡 비자 스폰서십은 기본 포함돼요." (토글 없음)
- **▸ 고급** 접기 섹션: `top_k`, `max_per_company`. 기본값 유지, 대부분 건드리지 않음.

### 프로필 탭 — 미리보기 (우측, sticky)

- **신규** `web/components/profile/ProfilePreview.tsx`.
- 상단 매칭수 카드:
  - **"N개 매칭"** 큰 숫자(tabular-nums) + 부제 "개 공고가 지금 프로필과 매칭".
  - "갱신 ↻" 버튼.
  - 데이터: `POST /api/recommend`에 현재 폼의 `RecommendProfile`을 전송 → 응답
    `RecommendResponse.total_candidates`를 표시(정직한 실수치).
  - 호출 시점: **페이지 로드 시 1회 + 갱신 버튼 클릭 시에만.** 키 입력마다 호출하지 않는다.
  - 상태: 로딩(스피너/스켈레톤), 실패("불러올 수 없어요" + 재시도).
- 하단 **6차원 반영 체크리스트**:
  - 6줄: 기술 스택 / 시니어리티 / 선호 지역 / 비자 / 연봉 / 의미 매칭(bio).
  - 입력 즉시 갱신(서버 호출 없음). 채워진 항목은 색 점 + 요약, 미입력은 회색
    "→ 미반영".
  - 색 팔레트는 기존 `web/components/recommend/ScoreBreakdownBars.tsx`의 6색과 통일.

### 상태 · 저장

- `web/components/profile/ProfileEditor.tsx`를 **재작성**: 폼 상태(`RecommendProfile`)를
  보유하는 상위 컨테이너.
  - `ProfileFields`에 값 + onChange 전달(편집).
  - `ProfilePreview`에 현재 값 전달(읽기/매칭수 호출).
  - 미리보기가 실시간 반응하도록 상태를 상위로 끌어올린다.
- 초기 로드: 기존대로 `GET /api/me/profile` → `exists && profile`이면 폼 채움.
- 저장: 기존 `PUT /api/me/profile` 유지. dirty 시 "변경사항 있음" 표시, 저장 후
  "저장됐어요"(success)·실패 시 인라인 에러. 저장 버튼은 미리보기 카드 하단에 배치.

### 데이터/계약 (불변)

- `RecommendProfile`(`web/lib/types.ts`)에 필요한 필드가 모두 존재(`bio` 포함) — 타입 변경 없음.
- `GET/PUT /api/me/profile`, `POST /api/recommend` 모두 기존 라우트 그대로 사용 — 백엔드 변경 없음.

## 반응형

- **데스크톱(lg+)**: 사이드바 | [완성도 바 → 폼(좌, 넓게) · 미리보기(우, sticky)].
- **태블릿/모바일**: 사이드바 → 상단 가로 탭. 2단 → 1단(폼 먼저, 미리보기 아래로).
  미리보기는 모바일에서 sticky 해제(콘텐츠 흐름에 포함).

## 엣지 케이스

- 빈 프로필(신규 가입): 사용자 입력 필드 비어 있음 → 완성도 0/5, 미리보기 6차원 중
  시니어리티·비자만 기본값으로 채워지고 나머지 회색,
  매칭수는 로드 시 호출하되 프로필이 비면 결과가 넓어/좁아질 수 있음 — 숫자만 정직히 표시.
- 매칭수 호출 실패/타임아웃: 숫자 자리에 "불러올 수 없어요" + 재시도. 폼/저장은 정상 동작.
- 미저장 변경 후 매칭수 갱신: 갱신은 **현재 폼 값**(미저장 포함) 기준으로 계산 — 저장과 무관.
- 태그 입력 중복/공백: trim + 중복 제거 후 칩 추가.

## 테스트

- **신규** 컴포넌트 단위 테스트:
  - `MeSidebar` — active 라우트 강조, 4개 항목 렌더.
  - `ProfileFields` — 태그 추가/제거, 세그먼트 선택, 슬라이더 값, bio 입력이 onChange로
    올바른 `RecommendProfile`을 만든다. 완성도 카운트.
  - `ProfilePreview` — 6차원 체크리스트의 채움/미반영 표시, 매칭수 호출은 로드 1회 +
    갱신 버튼에서만 발생(키 입력으로는 호출 안 됨), 실패 상태.
- **불변**: `ProfileForm.test.tsx`는 손대지 않는다(공유 폼 미변경).

## 파일 변경 요약

신규:
- `web/app/(main)/me/layout.tsx`
- `web/components/me/MeSidebar.tsx`
- `web/components/profile/ProfileFields.tsx`
- `web/components/profile/ProfilePreview.tsx`
- 위 신규 컴포넌트의 `*.test.tsx`

수정:
- `web/components/profile/ProfileEditor.tsx` (재작성 — 상태 상위화 + 2단 조립)
- `web/app/(main)/me/profile/page.tsx` (제목/래퍼를 쉘과 정리)
- 필요 시 `web/app/(main)/me/{saved,applications,coach}/page.tsx`의 바깥 `max-w` 래퍼만 정리

불변:
- `web/components/recommend/ProfileForm.tsx` 및 그 테스트
- `web/lib/types.ts`, `web/lib/schemas.ts`, 모든 백엔드/API 라우트

## 범위 밖 (YAGNI)

- 계정 프로필(이름/아바타/이메일) — 데이터 모델에 없음. 별도 작업.
- 비자 스폰서 필요 토글, 제외 회사 입력 — 이번엔 제외.
- 활동 요약 대시보드(저장/지원 건수) — 추후 마이페이지 "랜딩"으로 분리 가능.
- 매칭수 키 입력 디바운스 실시간 호출 — 비용/성능상 제외(온디맨드만).
