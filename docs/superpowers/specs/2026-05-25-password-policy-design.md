# 회원가입 비밀번호 정책 — 설계

작성일: 2026-05-25
브랜치: `worktree-auth-signup-validation` (origin/main 기반, 격리 워크트리)
상태: 검토 대기

## 1. 개요 / 목표

회원가입 비밀번호에 **복잡도 규칙**을 도입한다. 현재는 프론트 `minLength={8}`(HTML5)뿐이고 **백엔드는 비밀번호 규칙을 전혀 강제하지 않아**(`/api/auth/register` 직접 호출 시 `password:"1"`도 가입됨) 우회 가능한 보안 공백이 있다. 이를 **서버 측 권위 검증 + 프론트 실시간 피드백**으로 메운다.

## 2. 정책 (규칙)

| 규칙 | 값 |
|---|---|
| 최소 길이 | **10자** (문자 수) |
| 최대 길이 | **72바이트** (BCrypt 하드 한계 — 초과 시 조용히 잘림) |
| 소문자 | `[a-z]` 1개 이상 |
| 대문자 | `[A-Z]` 1개 이상 |
| 숫자 | `[0-9]` 1개 이상 |
| 특수문자 | **선택** (강제하지 않음) |

- **회원가입(register)에만 적용.** 로그인은 기존 비밀번호를 인증만 하며 정책 재검사하지 않는다(정책 변경 전 가입자 로그인 보장).
- 백엔드/프론트 규칙은 **동일해야** 하며, 백엔드가 **권위 있는 단일 강제 지점**(프론트는 UX).

## 3. 범위

**포함**
- 백엔드 `PasswordPolicy` 검증 + `AuthService.register` 연결 + 단위 테스트
- 프론트 `lib/password.ts` 규칙 함수 + `PasswordChecklist` + `CredentialsForm`(register 모드) 연동
- 기존 `AuthServiceTest` register 비밀번호를 정책 준수로 갱신

**제외**
- 로그인 정책 재검사, 비밀번호 변경/재설정 흐름, 흔한/유출 비밀번호 차단목록(추후), 강도 바

## 4. 백엔드 (권위 검증)

### 4.1 `PasswordPolicy` (신규, `com.devjobs.auth`)
순수 검증 클래스. DB/Spring 컨텍스트 불필요 → 단위 테스트 용이.

```java
public final class PasswordPolicy {
    private PasswordPolicy() {}
    public static final int MIN_LENGTH = 10;
    public static final int MAX_BYTES = 72; // BCrypt 한계

    /** 위반 시 ResponseStatusException(400, "weak_password: <이유>"). 통과 시 무반환. */
    public static void validate(String raw) { ... }
}
```
검사 순서/이유 코드(에러 메시지 일부):
1. `null`/길이 < 10 → `weak_password: too_short`
2. UTF-8 바이트 > 72 → `weak_password: too_long`
3. 소문자 없음 → `weak_password: need_lowercase`
4. 대문자 없음 → `weak_password: need_uppercase`
5. 숫자 없음 → `weak_password: need_digit`

> 길이는 **문자 수**(`raw.length()`), 최대는 **바이트**(`raw.getBytes(UTF_8).length`). 둘 다 적용.

### 4.2 `AuthService.register` 연결
`register(email, rawPassword, displayName)` 맨 앞에서 `PasswordPolicy.validate(rawPassword)` 호출 → 약한 비번은 `400`으로 즉시 거부. (이후 기존 흐름: 중복 이메일 조용히 noop → 인코딩 → 저장 → 인증 메일.) 계정 열거 안전성 유지(비번 검증은 이메일 존재를 누설하지 않음).

### 4.3 테스트
- **`PasswordPolicyTest`** (순수 JUnit, DB 불필요): 유효(`"Password123"`) 통과; `too_short`(9자), `too_long`(73바이트), `need_uppercase`(소문자+숫자만), `need_lowercase`, `need_digit` 각각 400 검증.
- **`AuthServiceTest` 갱신**: register 호출의 `"password123"`/`"otherpass456"` → 대문자 포함 정책 준수 값(`"Password123"`, `"Otherpass456"`)으로 변경(기존 테스트가 새 정책에 깨지지 않도록).

## 5. 프론트엔드 (UX)

### 5.1 `lib/password.ts` (신규)
백엔드 규칙 미러. **백엔드 `PasswordPolicy`와 동일하게 유지**(주석 명시).
```ts
export interface PasswordChecks { length: boolean; upper: boolean; lower: boolean; digit: boolean; }
export function checkPassword(pw: string): PasswordChecks {
  return { length: pw.length >= 10, upper: /[A-Z]/.test(pw), lower: /[a-z]/.test(pw), digit: /[0-9]/.test(pw) };
}
export function isPasswordValid(pw: string): boolean { /* 모든 checks true */ }
```
(최대 72바이트는 입력 `maxLength={72}` 소프트 캡 + 백엔드 권위 검증으로 처리; 프론트 바이트 계산은 생략.)

### 5.2 `PasswordChecklist` (신규 컴포넌트)
`checks: PasswordChecks`를 받아 4항목을 ✓(충족, success색)/✗(미충족, muted)로 표시. 항목: "10자 이상 / 대문자 / 소문자 / 숫자".

### 5.3 `CredentialsForm` 연동 (register 모드만)
- 비밀번호 입력: placeholder "비밀번호 (최소 10자, 대/소문자·숫자 포함)", `minLength={10}`, `maxLength={72}`.
- 입력 아래 `<PasswordChecklist checks={checkPassword(password)} />` 실시간 렌더.
- 제출 버튼: register 모드에서 `!isPasswordValid(password)`이면 비활성(기존 `pending` 비활성과 함께).
- **로그인 모드는 변경 없음**(체크리스트 X, minLength 등 기존 유지, 정책 게이팅 X).
- 백엔드가 400 반환 시(JS 우회 등 드문 경우) 기존 에러 표시 경로로 안내.

## 6. 에러 / 엣지

- 로그인은 정책과 무관(기존 비번 인증). 비밀번호 변경/재설정 흐름은 현재 없음(추후 동일 정책 적용 시 `PasswordPolicy`/`lib/password` 재사용).
- 다국어/이모지 비번: 길이는 문자 수, 최대는 바이트 → 멀티바이트 비번이 72바이트 초과하면 백엔드 400(프론트 maxLength=72자는 소프트 가이드).

## 7. 검증

- 백엔드: `cd backend && ./gradlew test --tests "com.devjobs.auth.PasswordPolicyTest" --tests "com.devjobs.auth.AuthServiceTest"` (PasswordPolicyTest 전부 통과 + 갱신된 AuthServiceTest 통과). 단, AuthServiceTest는 testcontainers(Docker) 필요.
- 프론트: `cd web && npm run typecheck && npm run build`. 라이브에서 회원가입 페이지 — 입력하며 체크리스트 ✓ 갱신, 규칙 미충족 시 가입 버튼 비활성, 직접 API로 약한 비번 → 400 확인.

## 8. 미해결 / 미래

- 흔한/유출 비밀번호 차단목록(예: 상위 N개), 강도 바, 비밀번호 변경·재설정 흐름에 동일 정책 적용. 모두 `PasswordPolicy`/`lib/password` 재사용으로 확장.
