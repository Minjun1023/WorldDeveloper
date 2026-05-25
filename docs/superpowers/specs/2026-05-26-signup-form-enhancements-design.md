# 회원가입/로그인 폼 개선 — 설계

작성일: 2026-05-26
브랜치: `worktree-auth-signup-validation` (격리 워크트리)
상태: 검토 대기

## 1. 개요 / 목표

회원가입/로그인 폼을 다음과 같이 개선한다:
- 회원가입에서 소셜 로그인 제거(이메일 가입에 집중).
- 이름(표시이름) **유니크 강제** + 이메일 **중복·형식** 실시간 확인.
- 비밀번호 **재확인** 필드(일치 검사).
- 비밀번호/비밀번호확인 + 로그인 비밀번호에 **표시 토글(눈 아이콘)**.

중복/사용가능 확인은 **실시간(debounced/포커아웃) 자동** 방식. 백엔드 availability 엔드포인트가 권위, 프론트가 UX.

## 2. 범위

**포함**
- 회원가입 페이지에서 소셜 버튼/구분선 제거
- displayName 유니크(대소문자 무시) — DB 인덱스 + 백엔드 거부 + 실시간 확인
- 이메일 형식 검증 + 실시간 중복 확인
- 비밀번호 확인 필드(일치)
- `PasswordInput`(눈 토글) — 회원가입(비번+비번확인) + 로그인(비번)
- availability 엔드포인트(GET) + Next 프록시

**제외**
- 로그인 페이지 소셜 제거(유지), 비밀번호 변경/재설정, register 이메일 중복을 409로 바꾸는 것(기존 enumeration-safe noop 유지 — availability가 UX 담당), 강도 바

## 3. 회원가입 페이지 (`web/app/(auth)/signup/page.tsx`)

- `OAuthButtons` import/렌더 + "또는 이메일로 가입" 구분선 **제거**. `CredentialsForm mode="register"`만 남김. (로그인 페이지 `signin/page.tsx`는 소셜 유지)

## 4. 백엔드

### 4.1 V8 마이그레이션 — displayName 유니크(대소문자 무시)
`backend/src/main/resources/db/migration/V8__user_display_name_unique.sql`:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_display_name_lower ON users (lower(display_name));
```
- 대소문자 무시 유니크. `lower(NULL)=NULL`이라 OAuth 계정(display_name NULL 가능)은 다중 허용.
- ⚠️ **적용 전 주의**: dev DB에 중복 display_name(이전 테스트 사용자 'T' 등)이 있으면 인덱스 생성 실패 → 적용 전 중복 정리 필요(플랜의 사전 단계).

### 4.2 UserRepository
추가: `boolean existsByDisplayNameIgnoreCase(String displayName)`, `boolean existsByEmail(String email)`.

### 4.3 이메일 형식 검증 (공유)
간단한 형식 검증을 백엔드에 둔다(register + check-email 공유). 예: `^[^@\s]+@[^@\s]+\.[^@\s]+$`. (별도 `EmailFormat.isValid(email)` 정적 메서드 또는 AuthService 내 헬퍼)

### 4.4 availability 엔드포인트 (AuthController, GET, 공개, 레이트리밋)
- `GET /api/v1/auth/check-name?name=<n>` → `{ "available": boolean }`. available = name 비어있지 않고 `!existsByDisplayNameIgnoreCase(name.trim())`.
- `GET /api/v1/auth/check-email?email=<e>` → `{ "available": boolean, "valid": boolean }`. valid = 형식 검증, available = valid && `!existsByEmail(normalize(email))`.
- 기존 `rateLimit(...)` 패턴 적용(남용/enumeration 완화). 이메일 availability는 가입 여부를 노출함(수용된 tradeoff).

### 4.5 AuthService.register 변경
순서: `PasswordPolicy.validate(rawPassword)`(기존) → **이메일 형식 검증(invalid → 400 `invalid_email`)** → **displayName 중복 검사(`existsByDisplayNameIgnoreCase(trim)` → 409 `name_taken`)** → (기존) 이메일 중복 noop → 저장. displayName은 **trim** 후 저장(인덱스 정합).

### 4.6 테스트 (JUnit)
- availability: check-name(사용가능/중복), check-email(사용가능/중복/형식오류) — `AuthControllerTest` 또는 신규.
- register: 중복 이름 → 409, 잘못된 이메일 형식 → 400, 정상 → 성공. 기존 register 테스트의 displayName이 서로 겹치지 않게 유지(겹치면 유니크 위반).

## 5. 프론트엔드

### 5.1 `PasswordInput` (신규, `web/components/auth/PasswordInput.tsx`, 클라이언트)
- `Input`을 감싸 오른쪽에 눈 토글 버튼(lucide `Eye`/`EyeOff`). 클릭 시 `type` password↔text 전환.
- `Input`의 props(value/onChange/placeholder/minLength/maxLength/required/aria-label 등) 전달. 토글 버튼은 `aria-label="비밀번호 표시/숨김"`.

### 5.2 Next 프록시 (availability)
- `web/app/api/auth/check-name/route.ts`, `web/app/api/auth/check-email/route.ts`: GET, 쿼리(name/email)를 백엔드 `/api/v1/auth/check-*`로 프록시, JSON 패스스루. 기존 `/api/auth/*` 프록시 패턴.

### 5.3 `CredentialsForm` 개편
- **비밀번호 입력을 `PasswordInput`으로 교체** → 로그인·회원가입 양쪽 눈 토글 자동.
- **register 모드 추가**:
  - **이름** 입력: 값 변경 시 debounce(~500ms) 후 `/api/auth/check-name` 호출 → 상태(idle/checking/available/taken) + 피드백("사용 가능 ✓" success / "이미 사용 중인 이름" destructive).
  - **이메일** 입력: debounce 후 `/api/auth/check-email` → (invalid → "이메일 형식이 올바르지 않아요" / taken → "이미 사용 중인 이메일" / available → "사용 가능 ✓").
  - **비밀번호 확인** 필드(`PasswordInput`): `password`와 실시간 일치 검사 → 불일치 시 "비밀번호가 일치하지 않습니다".
  - 기존 PasswordChecklist 유지.
  - **제출 게이팅**: `pending || nameStatus!=="available" || emailStatus!=="available" || !isPasswordValid(password) || password!==confirm` 이면 비활성.
- **login 모드**: 비밀번호만 `PasswordInput`으로(눈 토글). 그 외 변경 없음.

## 6. 에러 / 엣지

- availability 호출 실패(네트워크/백엔드 다운): 상태를 "확인 불가"로 두고 제출은 막지 않되 백엔드 register가 최종 방어(이름 409 / 형식 400). (UX: 확인 실패 시 조용히 통과 허용 — 백엔드가 권위)
- 레이스(확인 통과 후 타인이 선점): register가 409/noop로 처리.
- displayName trim 후 빈 문자열 → required로 프론트 차단 + 백엔드는 빈 이름 저장 안 함(기존 register는 displayName 비검증이나, 유니크 인덱스가 NULL만 허용하므로 빈 문자열 중복은 가능 — 빈 이름은 프론트 required로 방지).
- 비밀번호 확인 눈 토글은 비밀번호 토글과 독립(각자 상태).

## 7. 검증

- 백엔드: `./gradlew test --tests "com.devjobs.auth.*"` (availability + register 이름유니크/형식 + 기존 통과). **사전**: dev DB 중복 display_name 정리(V8 적용 위해).
- 프론트: `npm run typecheck && npm run build`. 라이브: 회원가입에서 이름/이메일 실시간 확인, 비번 확인 일치, 눈 토글(가입·로그인), 소셜 미표시, 게이팅.

## 8. 미해결 / 미래

- register 이메일 중복을 409로 통일(현재 noop) — enumeration 정책 재검토 시. 비밀번호 변경/재설정에 동일 정책. 이름 형식 규칙(길이/문자). availability 응답 캐싱/레이트리밋 정교화.
