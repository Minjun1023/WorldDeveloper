# 회원 프로필 기반 공고 추천 + AI 회원 게이팅 — 설계

날짜: 2026-06-03
상태: 설계 승인 대기(스펙 리뷰)
대상: backend(Spring) + ai(추천 로직 재사용) + web(Next.js)

## 배경 / 동기

현재 AI 공고 추천은 **자연어 프롬프트 입력**(NlRecommend → `/api/recommend-nl` → 백엔드 `NlRecommendService` → 프로필 파싱(규칙/LLM) → scorer)으로, **비회원도 IP당 시간 10회**까지 사용 가능하다.

방향 전환:
1. **AI 기능은 회원 전용**으로 게이팅한다.
2. **공고 추천은 회원가입 시 작성한 프로필**(기술스택·연차 등)에 따라 자동 추천한다. 자연어 프롬프트는 회원이 결과를 세분화하는 **보조 수단**으로만 남긴다.

토대: 추천 엔진이 쓰는 프로필 구조가 이미 정의돼 있다 — `AiClient.ParseResult.Profile` = `skills[]`, `seniority`, `years_experience`, `needs_visa_sponsorship`, `preferred_locations[]`, `remote_preference`, `desired_salary_usd`. 가입 시 이 항목을 받아 저장하면 NL 파싱 없이 그대로 추천에 쓸 수 있다. `UserEntity`(id/email/passwordHash/emailVerifiedAt/displayName/createdAt)에는 프로필 필드가 없어 신규 저장소가 필요하다.

## 승인된 결정 사항

- **NL 처리**: 프로필 기반이 기본, 회원 전용 NL은 보조(선택적 세분화).
- **가입 플로우**: 2단계(① 계정 ② 프로필). **프로필 단계는 스킵 가능**. 스킵 회원은 추천 시 "프로필 작성" 유도, 나중에 프로필 페이지에서 작성.
- **프로필 항목**: 기술스택, 시니어리티/연차, 선호 지역, 원격/이주 선호, 희망 연봉. **비자필요는 받지 않고 항상 true 고정**(한국인의 해외 취업이라 비자 스폰서십은 항상 필요).
- **AI = 회원 전용.** 비회원이 AI 추천 접근 시 **로그인 티저**(설명 + 로그인 버튼). 공고 검색은 비회원도 그대로.

## 데이터 모델

신규 `user_profiles` 테이블 (user 1:1). **Flyway: `V11__user_profiles.sql`** (현재 최대 V10).

```sql
CREATE TABLE user_profiles (
    user_id            UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    skills             TEXT[]  NOT NULL DEFAULT '{}',
    seniority          TEXT,          -- junior|mid|senior|lead|staff 등 (자유 텍스트/enum)
    years_experience   INT,
    preferred_locations TEXT[] NOT NULL DEFAULT '{}',  -- region value(us, germany …) 또는 자유 텍스트
    remote_preference  TEXT,          -- onsite|remote|hybrid 등 (recommend 의 remote_preference 와 동일 값셋)
    desired_salary_usd INT,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- 테이블명/PK 컬럼은 기존 `users` 테이블의 실제 이름/타입에 맞춘다(구현 시 `V6__auth_user_accounts.sql` 확인 — users 테이블/UUID id 가정).
- `needs_visa_sponsorship`은 저장하지 않는다. 추천 시 코드에서 `true` 고정.
- 프로필 "있음" 판정: row 존재 AND `skills` 가 비어있지 않음(최소 신호). 빈 프로필 = 미작성으로 간주.

## 백엔드 (Spring) — 인증 필요 엔드포인트

기존 인증(JWT 세션)에서 userId 추출. (`UserEntity`/JWT 필터 재사용 — 구현 시 현 인증 컨텍스트에서 userId 얻는 방법 확인.)

### `UserProfileEntity` + `UserProfileRepository`
- 엔티티: 위 컬럼 매핑. `text[]`는 기존 JobEntity 의 배열 매핑 패턴 따름.
- repo: `findByUserId(UUID)`.

### `GET /api/v1/me/profile`
- 인증 필요(없으면 401). 현재 유저 프로필 DTO 반환. 없으면 `{ exists: false }` 또는 빈 프로필.

### `PUT /api/v1/me/profile`
- 인증 필요. 바디 = 프로필 항목(skills/seniority/years/preferred_locations/remote_preference/desired_salary_usd). upsert. `updated_at` 갱신.
- 검증: skills 길이 제한(예: ≤30), 문자열 길이 제한 등 기본 방어.

### `POST /api/v1/recommend/me`
- 인증 필요(없으면 401). 저장된 프로필을 `Profile`로 로드 → `needs_visa_sponsorship=true` 강제 → 기존 `RecommendService` 로 추천(현 `NlRecommendService.toRecommendRequest` 매핑 재사용/추출).
- 프로필 없음(빈 skills) → `409`(또는 `{ needs_profile: true }`)로 "프로필 작성 필요" 신호.
- 선택 바디 `{ note?: string }`(보조 NL): 있으면 기존 `parseProfile(note)` 로 파싱해 저장 프로필과 **병합**(note 의 skills/locations 추가, 명시 항목 우선). 이 쿼리에 한해서만 적용(저장 안 함).
- 레이트리밋: 기존 `RateLimiter` 를 **userId 키**로(예: `"recommend:" + userId`). 익명 IP 기반 제거.

### 기존 `/api/v1/recommend/nl`
- AI 회원 전용화에 따라 **익명 NL 경로는 비활성/제거**. 회원 NL 보조는 `/recommend/me` 의 `note` 로 흡수. (웹에서 `recommend-nl` route + IP 포워딩 제거.)

## 웹 (Next.js)

### 가입 2단계 + 프로필 폼
- 1단계: 기존 계정 폼(이메일/비번/이름) 유지. 계정 생성 성공 후 2단계로.
- 2단계 `ProfileForm` (스킵 가능): 기술스택(태그 입력), 시니어리티(select), 연차(number), 선호 지역(다중 select — `/regions` 또는 DISCIPLINES 식), 원격/이주 선호(select: 원격/이주/둘다 ↔ remote_preference 매핑), 희망 연봉(number, USD). "건너뛰기"(→ 홈/인증안내) / "저장"(→ `PUT /me/profile` → 홈).
- 컴포넌트 분리: `ProfileForm`(폼+검증, 재사용), 가입 2단계 래퍼, 프로필 편집 페이지가 공유.

### 프로필 편집 페이지 `/me/profile`
- 인증 필요. 현재 프로필 로드(`GET /me/profile`) → `ProfileForm` 으로 보기/수정 → `PUT`. 헤더 계정 메뉴에 "내 프로필" 링크 추가.

### AI 추천 게이팅 (홈 "AI 추천" 탭 + `/recommend`)
세 상태:
1. **비회원** → 로그인 티저: "로그인하고 맞춤 공고 추천 받기" + 간단 설명 + [로그인](/signin) 버튼. (공고 검색 탭은 비회원도 그대로.)
2. **회원 + 프로필 있음** → 진입 시 `POST /recommend/me` 자동 호출 → 추천 카드 표시. 위에 "조건 추가"(선택 NL note) 입력 → note 포함 재요청으로 세분화.
3. **회원 + 프로필 없음(스킵/빈)** → "프로필을 작성하면 맞춤 추천을 받을 수 있어요" + [프로필 작성](/me/profile) CTA.
- 회원 여부는 서버 세션(`getSession`)으로 판정해 SSR 분기. 추천 호출은 인증 쿠키와 함께.

### 기존 `NlRecommend`
- 자연어-우선 컴포넌트에서 → 회원 프로필 추천 + 보조 note 입력 구조로 전환(또는 신규 `MemberRecommend` 로 대체, `RecommendationCard`/`ScoreBreakdownBars` 재사용). 결과 카드/점수 UI 재사용.

## 재사용 / 경계

| 신규 | 재사용 |
|---|---|
| user_profiles 테이블·엔티티·repo, /me/profile, /recommend/me, ProfileForm, 게이팅 UI, 로그인 티저 | RecommendService·scorer, Profile→RecommendRequest 매핑, RecommendationCard·ScoreBreakdownBars, 인증/세션, RateLimiter |

## 구현 단계(플랜 분할 힌트)
1. **백엔드**: V11 마이그레이션 + 엔티티/repo + `/me/profile`(GET/PUT) + `/recommend/me`(프로필+note, 인증, userId 레이트리밋).
2. **웹 프로필 입출력**: ProfileForm + 가입 2단계(스킵) + `/me/profile` 편집 + 계정메뉴 링크.
3. **웹 추천 게이팅**: 홈 AI 탭/`/recommend` 3상태(비회원 티저 / 프로필 추천+note / 프로필 미작성 CTA), 익명 recommend-nl 제거.

OAuth 가입자도 동일(계정만 생성, 프로필 미작성 상태 → 추천 시 프로필 작성 CTA).

## 스코프 제외(후속)
- 이력서 업로드/파싱으로 프로필 자동 채우기, 프로필 다중 버전, 추천 알림/구독은 이번 범위 밖.

## 검증 계획
- 백엔드: /me/profile upsert, /recommend/me (프로필 있음→추천, 없음→409, note 병합), 비인증 401, userId 레이트리밋 — 단위/통합 테스트.
- 웹: typecheck/lint/build + 라이브(Playwright): 비회원 티저 / 회원 프로필 추천 / 프로필 미작성 CTA / 가입 2단계 스킵·저장 / 프로필 편집.
