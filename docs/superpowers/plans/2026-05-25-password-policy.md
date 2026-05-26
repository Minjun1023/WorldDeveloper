# 회원가입 비밀번호 정책 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 회원가입 비밀번호에 복잡도 정책(10자/72바이트/소·대문자·숫자)을 백엔드 권위 검증 + 프론트 실시간 체크리스트로 도입한다.

**Architecture:** 백엔드 `PasswordPolicy`(순수 검증)를 `AuthService.register` 앞에 두어 약한 비번을 400으로 거부(보안 경계). 프론트 `lib/password.ts`(동일 규칙 미러) + `PasswordChecklist`로 UX. 로그인은 변경 없음.

**Tech Stack:** Spring Boot(JUnit), Next.js/TS. 검증: 백엔드=JUnit(PasswordPolicyTest 순수 + AuthServiceTest/ControllerTest testcontainers), 프론트=typecheck/build + 브라우저.

**관련 설계:** `docs/superpowers/specs/2026-05-25-password-policy-design.md`. 미러 대상: `web/components/auth/CredentialsForm.tsx`, `backend/.../auth/AuthService.java`.

**작업 공간:** 격리 워크트리 `worktree-auth-signup-validation` (origin/main 기반). 모든 작업·검증은 이 워크트리에서.

---

## 파일 구조

```
backend/src/main/java/com/devjobs/auth/PasswordPolicy.java        (신규) 순수 검증
backend/src/main/java/com/devjobs/auth/AuthService.java           (수정) register 앞 검증
backend/src/test/java/com/devjobs/auth/PasswordPolicyTest.java    (신규) 순수 JUnit
backend/src/test/java/com/devjobs/auth/AuthServiceTest.java       (수정) 비번 정책 준수로
backend/src/test/java/com/devjobs/auth/AuthControllerTest.java    (수정) 비번 정책 준수로

web/lib/password.ts                          (신규) 규칙 미러
web/components/auth/PasswordChecklist.tsx    (신규) 실시간 ✓ 체크리스트
web/components/auth/CredentialsForm.tsx      (수정) register 모드 연동
```

---

## Task 1: 백엔드 PasswordPolicy (JUnit TDD)

**Files:**
- Create: `backend/src/main/java/com/devjobs/auth/PasswordPolicy.java`
- Test: `backend/src/test/java/com/devjobs/auth/PasswordPolicyTest.java`

- [ ] **Step 1: 실패 테스트 작성** (순수 JUnit, DB 불필요)

`backend/src/test/java/com/devjobs/auth/PasswordPolicyTest.java`:

```java
package com.devjobs.auth;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class PasswordPolicyTest {

    @Test
    void validPasswordPasses() {
        assertDoesNotThrow(() -> PasswordPolicy.validate("Password123"));
    }

    @Test
    void tooShortRejected() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
            () -> PasswordPolicy.validate("Pass123")); // 7자
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().contains("too_short"));
    }

    @Test
    void tooLongRejected() {
        String longPw = "Aa1" + "x".repeat(70); // 73 ASCII 바이트
        assertTrue(assertThrows(ResponseStatusException.class,
            () -> PasswordPolicy.validate(longPw)).getReason().contains("too_long"));
    }

    @Test
    void missingUppercaseRejected() {
        assertTrue(assertThrows(ResponseStatusException.class,
            () -> PasswordPolicy.validate("password123")).getReason().contains("need_uppercase"));
    }

    @Test
    void missingLowercaseRejected() {
        assertTrue(assertThrows(ResponseStatusException.class,
            () -> PasswordPolicy.validate("PASSWORD123")).getReason().contains("need_lowercase"));
    }

    @Test
    void missingDigitRejected() {
        assertTrue(assertThrows(ResponseStatusException.class,
            () -> PasswordPolicy.validate("PasswordAbc")).getReason().contains("need_digit"));
    }

    @Test
    void nullRejected() {
        assertTrue(assertThrows(ResponseStatusException.class,
            () -> PasswordPolicy.validate(null)).getReason().contains("too_short"));
    }
}
```

- [ ] **Step 2: 실패 확인**

Run: `cd backend && ./gradlew test --tests "com.devjobs.auth.PasswordPolicyTest"`
Expected: 컴파일 실패 (PasswordPolicy 없음)

- [ ] **Step 3: 구현**

`backend/src/main/java/com/devjobs/auth/PasswordPolicy.java`:

```java
package com.devjobs.auth;

import java.nio.charset.StandardCharsets;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * 회원가입 비밀번호 정책: 10자 이상, 72바이트 이하, 소문자·대문자·숫자 각 1개 이상 (ASCII).
 * 프론트 web/lib/password.ts 와 동일 규칙 — 변경 시 양쪽 함께 수정.
 */
public final class PasswordPolicy {

    private PasswordPolicy() {}

    public static final int MIN_LENGTH = 10;
    public static final int MAX_BYTES = 72; // BCrypt 한계(초과 시 조용히 잘림)

    /** 위반 시 400 (reason "weak_password: &lt;이유&gt;"). 통과 시 무반환. */
    public static void validate(String raw) {
        if (raw == null || raw.length() < MIN_LENGTH) {
            throw weak("too_short");
        }
        if (raw.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES) {
            throw weak("too_long");
        }
        if (raw.chars().noneMatch(c -> c >= 'a' && c <= 'z')) {
            throw weak("need_lowercase");
        }
        if (raw.chars().noneMatch(c -> c >= 'A' && c <= 'Z')) {
            throw weak("need_uppercase");
        }
        if (raw.chars().noneMatch(c -> c >= '0' && c <= '9')) {
            throw weak("need_digit");
        }
    }

    private static ResponseStatusException weak(String reason) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, "weak_password: " + reason);
    }
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd backend && ./gradlew test --tests "com.devjobs.auth.PasswordPolicyTest"`
Expected: 7 tests passed

- [ ] **Step 5: 커밋**

```bash
git add backend/src/main/java/com/devjobs/auth/PasswordPolicy.java backend/src/test/java/com/devjobs/auth/PasswordPolicyTest.java
git commit -m "feat(auth): PasswordPolicy 검증 (10자/72바이트/대소문자/숫자)"
```

---

## Task 2: AuthService.register 연결 + 기존 테스트 비번 갱신

**Files:**
- Modify: `backend/src/main/java/com/devjobs/auth/AuthService.java` (register 메서드)
- Modify: `backend/src/test/java/com/devjobs/auth/AuthServiceTest.java`
- Modify: `backend/src/test/java/com/devjobs/auth/AuthControllerTest.java`

- [ ] **Step 1: register 앞에 정책 검증 추가**

`AuthService.register` 메서드 본문 첫 줄에 `PasswordPolicy.validate(rawPassword);` 추가. 현재:

```java
    @Transactional
    public void register(String email, String rawPassword, String displayName) {
        String norm = normalize(email);
        if (userRepo.findByEmail(norm).isPresent()) {
```

→ 변경:

```java
    @Transactional
    public void register(String email, String rawPassword, String displayName) {
        PasswordPolicy.validate(rawPassword);   // 약한 비밀번호 즉시 400
        String norm = normalize(email);
        if (userRepo.findByEmail(norm).isPresent()) {
```

(`PasswordPolicy` 는 같은 패키지 `com.devjobs.auth` 라 import 불필요.)

- [ ] **Step 2: 기존 테스트 비번을 정책 준수로 갱신**

두 테스트 파일에서 정책 위반 비번(대문자 없음)을 전부 치환. register 와 login 이 같은 값을 쓰므로 **전역 치환**으로 일관성 유지:
- `password123` → `Password123`
- `otherpass456` → `Otherpass456`

```bash
cd backend
sed -i '' 's/password123/Password123/g; s/otherpass456/Otherpass456/g' \
  src/test/java/com/devjobs/auth/AuthServiceTest.java \
  src/test/java/com/devjobs/auth/AuthControllerTest.java
# 남은 위반 비번 확인 (없어야 함)
grep -rn "password123\|otherpass456" src/test/java/com/devjobs/auth/ || echo "(모두 치환됨)"
```

- [ ] **Step 3: 백엔드 auth 테스트 전체 통과 확인** (testcontainers → Docker 필요)

Run: `cd backend && ./gradlew test --tests "com.devjobs.auth.*"`
Expected: PasswordPolicyTest + AuthServiceTest + AuthControllerTest 모두 통과. (만약 AuthControllerTest 의 "register → 400 기대" 같은 테스트가 새로 생기는 게 아니라 기존 200/204 기대라면, 갱신된 비번이 정책을 통과하므로 그대로 200/204.)

- [ ] **Step 4: 커밋**

```bash
git add backend/src/main/java/com/devjobs/auth/AuthService.java \
        backend/src/test/java/com/devjobs/auth/AuthServiceTest.java \
        backend/src/test/java/com/devjobs/auth/AuthControllerTest.java
git commit -m "feat(auth): register 에 PasswordPolicy 적용 + 기존 테스트 비번 정책 준수"
```

---

## Task 3: 프론트 lib/password.ts (규칙 미러)

**Files:**
- Create: `web/lib/password.ts`

- [ ] **Step 1: 작성**

```ts
// 백엔드 backend/.../auth/PasswordPolicy.java 와 동일 규칙 (10자, 대/소문자, 숫자, ASCII).
// 규칙 변경 시 양쪽을 함께 수정할 것. (최대 72바이트는 입력 maxLength + 백엔드 권위검증으로 처리)

export interface PasswordChecks {
  length: boolean;
  upper: boolean;
  lower: boolean;
  digit: boolean;
}

export function checkPassword(pw: string): PasswordChecks {
  return {
    length: pw.length >= 10,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    digit: /[0-9]/.test(pw),
  };
}

export function isPasswordValid(pw: string): boolean {
  const c = checkPassword(pw);
  return c.length && c.upper && c.lower && c.digit;
}
```

- [ ] **Step 2: 타입체크 + 커밋**

Run: `cd web && npm run typecheck`
Expected: 에러 없음

```bash
git add web/lib/password.ts
git commit -m "feat(web-auth): 비밀번호 규칙 미러 lib/password.ts"
```

---

## Task 4: PasswordChecklist 컴포넌트

**Files:**
- Create: `web/components/auth/PasswordChecklist.tsx`

- [ ] **Step 1: 작성**

```tsx
import type { PasswordChecks } from "@/lib/password";

const ITEMS: { key: keyof PasswordChecks; label: string }[] = [
  { key: "length", label: "10자 이상" },
  { key: "upper", label: "대문자 포함" },
  { key: "lower", label: "소문자 포함" },
  { key: "digit", label: "숫자 포함" },
];

export function PasswordChecklist({ checks }: { checks: PasswordChecks }) {
  return (
    <ul className="space-y-1 text-caption">
      {ITEMS.map(({ key, label }) => (
        <li
          key={key}
          className={checks[key] ? "text-success" : "text-muted-foreground"}
        >
          {checks[key] ? "✓" : "○"} {label}
        </li>
      ))}
    </ul>
  );
}
```

(`text-success` 는 tailwind.config 에 정의됨.)

- [ ] **Step 2: 타입체크 + 커밋**

Run: `cd web && npm run typecheck`
Expected: 에러 없음

```bash
git add web/components/auth/PasswordChecklist.tsx
git commit -m "feat(web-auth): PasswordChecklist 실시간 요건 표시"
```

---

## Task 5: CredentialsForm register 모드 연동

**Files:**
- Modify: `web/components/auth/CredentialsForm.tsx`

- [ ] **Step 1: import 추가**

기존 import 블록(`@/components/ui/input` 아래)에 추가:

```tsx
import { checkPassword, isPasswordValid } from "@/lib/password";
import { PasswordChecklist } from "@/components/auth/PasswordChecklist";
```

- [ ] **Step 2: 비밀번호 입력 + 체크리스트 (register 모드)**

현재 비밀번호 Input 블록:

```tsx
      <Input
        type="password"
        placeholder="비밀번호 (최소 8자)"
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
```

→ 교체:

```tsx
      <Input
        type="password"
        placeholder={
          mode === "register" ? "비밀번호 (최소 10자, 대/소문자·숫자 포함)" : "비밀번호"
        }
        minLength={mode === "register" ? 10 : undefined}
        maxLength={72}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {mode === "register" && <PasswordChecklist checks={checkPassword(password)} />}
```

- [ ] **Step 3: 제출 버튼 게이팅 (register 모드만)**

현재:

```tsx
      <Button type="submit" disabled={pending} className="w-full">
```

→ 교체:

```tsx
      <Button
        type="submit"
        disabled={pending || (mode === "register" && !isPasswordValid(password))}
        className="w-full"
      >
```

- [ ] **Step 4: 타입체크 + 빌드**

Run: `cd web && npm run typecheck && npm run build`
Expected: 성공, `/signup` 빌드됨

- [ ] **Step 5: 커밋**

```bash
git add web/components/auth/CredentialsForm.tsx
git commit -m "feat(web-auth): 회원가입 비밀번호 실시간 체크리스트 + 제출 게이팅"
```

---

## Task 6: 라이브 검증 (선택, 라이브 스택)

- [ ] DB+backend+ai+web 기동(워크트리에서) 후 `/signup`:
  - 비밀번호 입력하며 체크리스트 ✓ 실시간 갱신
  - 규칙 미충족 시 "가입하기" 버튼 비활성
  - 약한 비번을 `/api/auth/register` 로 직접 POST → `400 weak_password: ...`
  - 정책 통과 비번으로 가입 → 인증 메일 흐름 정상
- 로그인 페이지는 변경 없음 확인.

> 워크트리에서 라이브 기동 시 메인 체크아웃의 스택과 포트(3000/8080/8001/DB)가 겹치므로, 다른 세션 스택이 떠 있으면 포트/Flyway 충돌 주의. 단위/타입/빌드 검증으로 충분하며 라이브는 선택.

---

## Self-Review (작성자 체크 결과)

- **스펙 커버리지**: 정책 규칙(§2)=PasswordPolicy(T1) ✓, 백엔드 강제(§4.2)=register 연결(T2) ✓, 단위테스트(§4.3)=PasswordPolicyTest(T1)+테스트 갱신(T2) ✓, lib 미러(§5.1)=T3 ✓, 체크리스트(§5.2)=T4 ✓, CredentialsForm 게이팅(§5.3)=T5 ✓, 로그인 무변경=T5(register 모드 한정) ✓.
- **플레이스홀더**: 모든 단계 실제 코드/명령. 없음.
- **타입 일관성**: 백엔드 ASCII 검사(`[a-z]/[A-Z]/[0-9]`) ↔ 프론트 정규식 동일. `PasswordChecks` 키(length/upper/lower/digit) ↔ checkPassword 반환 ↔ PasswordChecklist ITEMS 키 일치. `weak_password: <reason>` reason 코드(too_short/too_long/need_lowercase/need_uppercase/need_digit)가 PasswordPolicyTest 단언과 일치.
- **검증 도구**: 백엔드 PasswordPolicyTest=순수 JUnit(DB 불필요), AuthServiceTest/ControllerTest=testcontainers(Docker). 프론트=typecheck/build.
- **주의**: register 와 login 이 같은 테스트 비번을 쓰므로 전역 sed 치환으로 일관성 유지(T2). min=문자수, max=바이트.
