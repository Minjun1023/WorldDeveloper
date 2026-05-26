# 회원가입/로그인 폼 개선 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 회원가입에서 소셜 제거, 이름 유니크/이메일 형식·중복 실시간 확인, 비밀번호 재확인, 비밀번호 표시 토글(가입·로그인)을 추가한다.

**Architecture:** 백엔드 availability 엔드포인트(권위) + displayName 유니크(대소문자무시 인덱스) + register 검증 강화. 프론트 `PasswordInput`(눈 토글) + `CredentialsForm` 개편(debounced 실시간 확인 + 게이팅). 로그인은 비번 눈 토글만.

**Tech Stack:** Spring Boot(JUnit), Next.js/TS, lucide-react. 검증: 백엔드 JUnit(EmailFormat 순수 + AuthService/Controller testcontainers), 프론트 typecheck/build + 라이브.

**관련 설계:** `docs/superpowers/specs/2026-05-26-signup-form-enhancements-design.md`. 작업 공간: 격리 워크트리 `worktree-auth-signup-validation`.

---

## 파일 구조

```
backend/src/main/resources/db/migration/V8__user_display_name_unique.sql   (신규)
backend/src/main/java/com/devjobs/auth/EmailFormat.java                     (신규) 순수 형식검증
backend/src/main/java/com/devjobs/auth/UserRepository.java                  (수정) exists 메서드
backend/src/main/java/com/devjobs/auth/AuthService.java                     (수정) register + availability
backend/src/main/java/com/devjobs/auth/AuthController.java                  (수정) check-name/check-email
backend/src/test/java/com/devjobs/auth/EmailFormatTest.java                 (신규)
backend/src/test/java/com/devjobs/auth/AuthServiceTest.java                 (수정)
backend/src/test/java/com/devjobs/auth/AuthControllerTest.java              (수정)

web/app/(auth)/signup/page.tsx                  (수정) 소셜 제거
web/components/auth/PasswordInput.tsx           (신규) 눈 토글
web/app/api/auth/check-name/route.ts            (신규) 프록시
web/app/api/auth/check-email/route.ts           (신규) 프록시
web/components/auth/CredentialsForm.tsx         (수정) 개편
```

---

## Task 1: V8 마이그레이션 — displayName 유니크(대소문자 무시)

**Files:**
- Create: `backend/src/main/resources/db/migration/V8__user_display_name_unique.sql`

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- 표시이름(display_name) 대소문자 무시 유니크. lower(NULL)=NULL 이라 OAuth 계정(NULL) 다중 허용.
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_display_name_lower ON users (lower(display_name));
```

- [ ] **Step 2: 적용 확인 (testcontainers 는 fresh DB라 깨끗하게 적용됨)**

Run: `cd backend && ./gradlew compileJava`
Expected: 성공. (실제 적용은 Task 3/4 테스트의 testcontainers 기동 시 검증. dev DB 라이브는 중복 정리 필요 — 마지막 라이브 검증 태스크 참고.)

- [ ] **Step 3: 커밋**

```bash
git add backend/src/main/resources/db/migration/V8__user_display_name_unique.sql
git commit -m "feat(auth): display_name 대소문자무시 유니크 인덱스 (V8)"
```

---

## Task 2: EmailFormat (JUnit TDD) + UserRepository exists 메서드

**Files:**
- Create: `backend/src/main/java/com/devjobs/auth/EmailFormat.java`
- Test: `backend/src/test/java/com/devjobs/auth/EmailFormatTest.java`
- Modify: `backend/src/main/java/com/devjobs/auth/UserRepository.java`

- [ ] **Step 1: 실패 테스트**

`backend/src/test/java/com/devjobs/auth/EmailFormatTest.java`:

```java
package com.devjobs.auth;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class EmailFormatTest {
    @Test void validEmails() {
        assertTrue(EmailFormat.isValid("a@b.com"));
        assertTrue(EmailFormat.isValid("user.name+tag@sub.example.co.kr"));
    }
    @Test void invalidEmails() {
        assertFalse(EmailFormat.isValid(null));
        assertFalse(EmailFormat.isValid(""));
        assertFalse(EmailFormat.isValid("no-at"));
        assertFalse(EmailFormat.isValid("a@b"));            // 도메인 점 없음
        assertFalse(EmailFormat.isValid("a b@c.com"));      // 공백
        assertFalse(EmailFormat.isValid("a@@b.com"));
    }
}
```

- [ ] **Step 2: 실패 확인**

Run: `cd backend && ./gradlew test --tests "com.devjobs.auth.EmailFormatTest"`
Expected: 컴파일 실패

- [ ] **Step 3: EmailFormat 구현**

`backend/src/main/java/com/devjobs/auth/EmailFormat.java`:

```java
package com.devjobs.auth;

import java.util.regex.Pattern;

/** 간단한 이메일 형식 검증 (register + check-email 공유). */
public final class EmailFormat {

    private EmailFormat() {}

    private static final Pattern RE = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    public static boolean isValid(String email) {
        return email != null && RE.matcher(email.trim()).matches();
    }
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd backend && ./gradlew test --tests "com.devjobs.auth.EmailFormatTest"`
Expected: 2 tests passed

- [ ] **Step 5: UserRepository 메서드 추가**

`backend/src/main/java/com/devjobs/auth/UserRepository.java` 의 인터페이스에 추가:

```java
    boolean existsByEmail(String email);

    boolean existsByDisplayNameIgnoreCase(String displayName);
```

- [ ] **Step 6: 컴파일 + 커밋**

Run: `cd backend && ./gradlew compileJava`
Expected: 성공

```bash
git add backend/src/main/java/com/devjobs/auth/EmailFormat.java backend/src/test/java/com/devjobs/auth/EmailFormatTest.java backend/src/main/java/com/devjobs/auth/UserRepository.java
git commit -m "feat(auth): EmailFormat 검증 + UserRepository exists 메서드"
```

---

## Task 3: AuthService — register 강화 + availability 로직

**Files:**
- Modify: `backend/src/main/java/com/devjobs/auth/AuthService.java`
- Modify: `backend/src/test/java/com/devjobs/auth/AuthServiceTest.java`

- [ ] **Step 1: register 변경 + availability 메서드 추가**

`AuthService.register` 를 아래로 교체(이메일 형식 + 이름 유니크 추가; trim 저장):

```java
    @Transactional
    public void register(String email, String rawPassword, String displayName) {
        PasswordPolicy.validate(rawPassword);
        if (!EmailFormat.isValid(email)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid_email");
        }
        String name = displayName == null ? null : displayName.trim();
        if (name != null && !name.isEmpty() && userRepo.existsByDisplayNameIgnoreCase(name)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "name_taken");
        }
        String norm = normalize(email);
        if (userRepo.findByEmail(norm).isPresent()) {
            return; // 계정 열거 방지: 조용히 반환
        }
        UserEntity u = new UserEntity(norm, passwordEncoder.encode(rawPassword), name);
        userRepo.save(u);
        issueAndSendVerification(u);
    }

    /** 표시이름 사용 가능 여부 (비어있지 않고 중복 아님). */
    @Transactional(readOnly = true)
    public boolean isDisplayNameAvailable(String displayName) {
        String n = displayName == null ? "" : displayName.trim();
        return !n.isEmpty() && !userRepo.existsByDisplayNameIgnoreCase(n);
    }

    /** 이메일 형식 유효성 + 사용 가능 여부. */
    @Transactional(readOnly = true)
    public EmailAvailability checkEmail(String email) {
        boolean valid = EmailFormat.isValid(email);
        boolean available = valid && !userRepo.existsByEmail(normalize(email));
        return new EmailAvailability(valid, available);
    }

    public record EmailAvailability(boolean valid, boolean available) {}
```

- [ ] **Step 2: AuthServiceTest 에 케이스 추가 + 중복 이름 방지**

`AuthServiceTest` 에 추가:

```java
    @Test
    void registerRejectsDuplicateDisplayName() {
        authService.register("first@example.com", "Password123", "SameName");
        org.springframework.web.server.ResponseStatusException ex =
            org.junit.jupiter.api.Assertions.assertThrows(
                org.springframework.web.server.ResponseStatusException.class,
                () -> authService.register("second@example.com", "Password123", "SameName"));
        org.junit.jupiter.api.Assertions.assertEquals(409, ex.getStatusCode().value());
    }

    @Test
    void registerRejectsInvalidEmail() {
        org.springframework.web.server.ResponseStatusException ex =
            org.junit.jupiter.api.Assertions.assertThrows(
                org.springframework.web.server.ResponseStatusException.class,
                () -> authService.register("not-an-email", "Password123", "ValidName"));
        org.junit.jupiter.api.Assertions.assertEquals(400, ex.getStatusCode().value());
    }

    @Test
    void availabilityChecks() {
        authService.register("taken-mail@example.com", "Password123", "TakenName");
        org.junit.jupiter.api.Assertions.assertFalse(authService.isDisplayNameAvailable("TakenName"));
        org.junit.jupiter.api.Assertions.assertFalse(authService.isDisplayNameAvailable("takenname")); // 대소문자무시
        org.junit.jupiter.api.Assertions.assertTrue(authService.isDisplayNameAvailable("FreshName"));
        org.junit.jupiter.api.Assertions.assertFalse(authService.checkEmail("taken-mail@example.com").available());
        org.junit.jupiter.api.Assertions.assertTrue(authService.checkEmail("fresh-mail@example.com").available());
        org.junit.jupiter.api.Assertions.assertFalse(authService.checkEmail("bad-email").valid());
    }
```

⚠️ 그리고 **기존 register 호출들의 displayName 이 한 테스트 안에서 겹치지 않게** 확인. (테스트가 @Transactional 롤백 격리면 테스트 간 겹침은 무관. 같은 테스트 내 중복만 distinct 화.) 새로 추가한 이름("SameName"/"TakenName"/"ValidName"/"FreshName")은 기존과 겹치지 않음.

- [ ] **Step 3: 통과 확인**

Run: `cd backend && ./gradlew test --tests "com.devjobs.auth.AuthServiceTest"`
Expected: 기존 + 신규 3 케이스 모두 통과. 실패 시 같은 테스트 내 displayName 중복을 distinct 화.

- [ ] **Step 4: 커밋**

```bash
git add backend/src/main/java/com/devjobs/auth/AuthService.java backend/src/test/java/com/devjobs/auth/AuthServiceTest.java
git commit -m "feat(auth): register 이메일형식/이름유니크 + availability 로직 + 테스트"
```

---

## Task 4: AuthController — check-name / check-email 엔드포인트

**Files:**
- Modify: `backend/src/main/java/com/devjobs/auth/AuthController.java`
- Modify: `backend/src/test/java/com/devjobs/auth/AuthControllerTest.java`

- [ ] **Step 1: 엔드포인트 추가**

`AuthController` 에 import 추가: `import java.util.Map;`, `import org.springframework.web.bind.annotation.GetMapping;`, `import org.springframework.web.bind.annotation.RequestParam;` (없으면). `@PostMapping("/exchange")` 위에 추가:

```java
    @GetMapping("/check-name")
    public Map<String, Boolean> checkName(@RequestParam String name, HttpServletRequest req) {
        rateLimit("check", req);
        return Map.of("available", auth.isDisplayNameAvailable(name));
    }

    @GetMapping("/check-email")
    public Map<String, Boolean> checkEmail(@RequestParam String email, HttpServletRequest req) {
        rateLimit("check", req);
        AuthService.EmailAvailability r = auth.checkEmail(email);
        return Map.of("valid", r.valid(), "available", r.available());
    }
```

- [ ] **Step 2: AuthControllerTest — 중복 displayName 정리 + availability 테스트**

먼저 기존 register 호출들의 displayName 이 **같은 테스트 안에서 중복**이면 distinct 로 수정(예: 두 번 쓰인 `"C"` → `"C1"`, `"C2"`). 그 다음 추가:

```java
    @Test
    void checkNameEndpoint() throws Exception {
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("email", "cn@example.com", "password", "Password123", "displayName", "TakenCtrl"))))
            .andExpect(status().isOk());
        mvc.perform(get("/api/v1/auth/check-name").param("name", "TakenCtrl"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.available").value(false));
        mvc.perform(get("/api/v1/auth/check-name").param("name", "FreshCtrl"))
            .andExpect(jsonPath("$.available").value(true));
    }

    @Test
    void checkEmailEndpoint() throws Exception {
        mvc.perform(get("/api/v1/auth/check-email").param("email", "bad"))
            .andExpect(jsonPath("$.valid").value(false));
        mvc.perform(get("/api/v1/auth/check-email").param("email", "free-ctrl@example.com"))
            .andExpect(jsonPath("$.valid").value(true))
            .andExpect(jsonPath("$.available").value(true));
    }
```

(`get`, `jsonPath` 정적 import 필요 시 추가: `import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;`, `import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;`)

- [ ] **Step 3: 통과 확인**

Run: `cd backend && ./gradlew test --tests "com.devjobs.auth.AuthControllerTest"`
Expected: 기존(중복이름 수정 후) + 신규 통과

- [ ] **Step 4: 커밋**

```bash
git add backend/src/main/java/com/devjobs/auth/AuthController.java backend/src/test/java/com/devjobs/auth/AuthControllerTest.java
git commit -m "feat(auth): GET check-name/check-email availability 엔드포인트"
```

---

## Task 5: 회원가입 페이지 소셜 제거

**Files:**
- Modify: `web/app/(auth)/signup/page.tsx`

- [ ] **Step 1: OAuthButtons + 구분선 제거**

`web/app/(auth)/signup/page.tsx` 에서 `OAuthButtons` import 와 렌더, "또는 이메일로 가입" 구분선 줄을 제거. 결과(핵심부):

```tsx
import Link from "next/link";

import { CredentialsForm } from "@/components/auth/CredentialsForm";

export default function SignUpPage() {
  return (
    <div className="mx-auto max-w-sm space-y-6 py-8">
      <h1 className="text-display">회원가입</h1>
      <CredentialsForm mode="register" />
      <p className="text-body-sm text-muted-foreground">
        이미 계정이 있나요?{" "}
        <Link href="/signin" className="text-primary underline">
          로그인
        </Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 + 커밋**

Run: `cd web && npm run typecheck`
Expected: 에러 없음 (OAuthButtons/BACKEND_PUBLIC_URL 미사용 import 제거 확인)

```bash
git add "web/app/(auth)/signup/page.tsx"
git commit -m "feat(web-auth): 회원가입에서 소셜 로그인 제거"
```

---

## Task 6: PasswordInput (눈 토글)

**Files:**
- Create: `web/components/auth/PasswordInput.tsx`

- [ ] **Step 1: 작성**

```tsx
"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function PasswordInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? "text" : "password"} className={cn("pr-10", className)} {...props} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "비밀번호 숨김" : "비밀번호 표시"}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 + 커밋**

Run: `cd web && npm run typecheck`
Expected: 에러 없음 (lucide-react Eye/EyeOff 존재)

```bash
git add web/components/auth/PasswordInput.tsx
git commit -m "feat(web-auth): PasswordInput (비밀번호 표시 토글)"
```

---

## Task 7: Next 프록시 — check-name / check-email

**Files:**
- Create: `web/app/api/auth/check-name/route.ts`
- Create: `web/app/api/auth/check-email/route.ts`

- [ ] **Step 1: check-name 프록시**

`web/app/api/auth/check-name/route.ts`:

```ts
import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get("name") ?? "";
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/v1/auth/check-name?name=${encodeURIComponent(name)}`,
      { cache: "no-store" },
    );
    return NextResponse.json(await res.json().catch(() => ({ available: false })), {
      status: res.status,
    });
  } catch {
    return NextResponse.json({ available: false }, { status: 502 });
  }
}
```

- [ ] **Step 2: check-email 프록시**

`web/app/api/auth/check-email/route.ts`:

```ts
import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function GET(req: Request) {
  const email = new URL(req.url).searchParams.get("email") ?? "";
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/v1/auth/check-email?email=${encodeURIComponent(email)}`,
      { cache: "no-store" },
    );
    return NextResponse.json(await res.json().catch(() => ({ valid: false, available: false })), {
      status: res.status,
    });
  } catch {
    return NextResponse.json({ valid: false, available: false }, { status: 502 });
  }
}
```

- [ ] **Step 3: 타입체크 + 커밋**

Run: `cd web && npm run typecheck`
Expected: 에러 없음

```bash
git add web/app/api/auth/check-name/route.ts web/app/api/auth/check-email/route.ts
git commit -m "feat(web-auth): availability 프록시 (check-name/check-email)"
```

---

## Task 8: CredentialsForm 개편 (눈 토글 + 비번확인 + 실시간 확인 + 게이팅)

**Files:**
- Modify: `web/components/auth/CredentialsForm.tsx`

- [ ] **Step 1: 전체 교체**

`web/components/auth/CredentialsForm.tsx` 를 아래로 교체 (register: 이름/이메일 debounced 확인 + 비번확인 + 게이팅; login: 비번 PasswordInput만):

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { PasswordChecklist } from "@/components/auth/PasswordChecklist";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkPassword, isPasswordValid } from "@/lib/password";

type Mode = "login" | "register";
type Avail = "idle" | "checking" | "ok" | "taken" | "invalid";

export function CredentialsForm({ mode, callbackUrl = "/" }: { mode: Mode; callbackUrl?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [nameAvail, setNameAvail] = useState<Avail>("idle");
  const [emailAvail, setEmailAvail] = useState<Avail>("idle");

  // 이름 실시간 확인 (register, debounce 500ms)
  useEffect(() => {
    if (mode !== "register") return;
    const n = displayName.trim();
    if (!n) {
      setNameAvail("idle");
      return;
    }
    setNameAvail("checking");
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-name?name=${encodeURIComponent(n)}`);
        const d = (await res.json()) as { available: boolean };
        setNameAvail(d.available ? "ok" : "taken");
      } catch {
        setNameAvail("idle");
      }
    }, 500);
    return () => clearTimeout(t);
  }, [displayName, mode]);

  // 이메일 실시간 확인 (register, debounce 500ms)
  useEffect(() => {
    if (mode !== "register") return;
    const e = email.trim();
    if (!e) {
      setEmailAvail("idle");
      return;
    }
    setEmailAvail("checking");
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-email?email=${encodeURIComponent(e)}`);
        const d = (await res.json()) as { valid: boolean; available: boolean };
        setEmailAvail(!d.valid ? "invalid" : d.available ? "ok" : "taken");
      } catch {
        setEmailAvail("idle");
      }
    }, 500);
    return () => clearTimeout(t);
  }, [email, mode]);

  const pwValid = isPasswordValid(password);
  const pwMatch = password.length > 0 && password === confirm;
  const canSubmit =
    !pending &&
    (mode === "login" ||
      (nameAvail === "ok" && emailAvail === "ok" && pwValid && pwMatch));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (mode === "register") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password, display_name: displayName.trim() }),
        });
        if (!res.ok) throw new Error("가입에 실패했어요. 입력을 확인해 주세요.");
        setRegistered(true);
      } else {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (res.status === 403) throw new Error("이메일 인증이 필요해요. 받은 인증 메일의 링크를 눌러주세요.");
        if (!res.ok) throw new Error("이메일 또는 비밀번호가 올바르지 않아요.");
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했어요.");
    } finally {
      setPending(false);
    }
  }

  async function resend() {
    setError(null);
    await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
  }

  if (mode === "register" && registered) {
    return (
      <div className="space-y-3 text-body-sm">
        <p>
          <strong>{email}</strong> 로 인증 메일을 보냈어요. 메일의 링크를 눌러 이메일을 인증한 뒤 로그인하세요.
        </p>
        <button type="button" onClick={resend} className="text-primary underline">
          인증 메일 다시 보내기
        </button>
      </div>
    );
  }

  const availMsg = (s: Avail, okMsg: string, takenMsg: string, invalidMsg?: string) => {
    if (s === "ok") return <p className="text-caption text-success">{okMsg}</p>;
    if (s === "taken") return <p className="text-caption text-destructive">{takenMsg}</p>;
    if (s === "invalid" && invalidMsg) return <p className="text-caption text-destructive">{invalidMsg}</p>;
    if (s === "checking") return <p className="text-caption text-muted-foreground">확인 중…</p>;
    return null;
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      {mode === "register" && (
        <div className="space-y-1">
          <Input
            type="text"
            placeholder="이름"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
          {availMsg(nameAvail, "사용 가능한 이름이에요", "이미 사용 중인 이름이에요")}
        </div>
      )}

      <div className="space-y-1">
        <Input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {mode === "register" &&
          availMsg(emailAvail, "사용 가능한 이메일이에요", "이미 사용 중인 이메일이에요", "이메일 형식이 올바르지 않아요")}
      </div>

      <PasswordInput
        placeholder={mode === "register" ? "비밀번호 (최소 10자, 대/소문자·숫자 포함)" : "비밀번호"}
        minLength={mode === "register" ? 10 : undefined}
        maxLength={mode === "register" ? 72 : undefined}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {mode === "register" && <PasswordChecklist checks={checkPassword(password)} />}

      {mode === "register" && (
        <div className="space-y-1">
          <PasswordInput
            placeholder="비밀번호 확인"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          {confirm.length > 0 && !pwMatch && (
            <p className="text-caption text-destructive">비밀번호가 일치하지 않습니다</p>
          )}
        </div>
      )}

      {error && <p className="text-destructive text-body-sm">{error}</p>}

      <Button type="submit" disabled={!canSubmit} className="w-full">
        {pending ? "처리 중…" : mode === "register" ? "가입하기" : "로그인"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: 타입체크 + 빌드**

Run: `cd web && npm run typecheck && npm run build`
Expected: 성공, `/signup`·`/signin` 빌드

- [ ] **Step 3: 커밋**

```bash
git add web/components/auth/CredentialsForm.tsx
git commit -m "feat(web-auth): 이름/이메일 실시간 확인 + 비번확인 + 눈토글 + 제출 게이팅"
```

---

## Task 9: 라이브 검증 (선택, 라이브 스택)

- [ ] **사전(dev DB)**: V8 유니크 인덱스가 적용되려면 dev DB에 중복 display_name 없어야 함. 이전 테스트 사용자 정리:
  ```bash
  docker exec dev-jobs-postgres psql -U devjobs -d devjobs -c "DELETE FROM users WHERE email LIKE '%demo@test.com' OR email LIKE '%demo2@test.com';"
  # 그 외 중복이 있으면: SELECT lower(display_name), count(*) FROM users GROUP BY 1 HAVING count(*)>1; 로 확인 후 정리
  ```
- [ ] 워크트리 백엔드(8081)+웹(3100) 기동 후 `/signup`:
  - 소셜 버튼 없음, 이름/이메일 입력 시 실시간 "사용 가능/중복/형식오류", 비번 체크리스트 + 확인 일치, 눈 토글, 전부 충족 시에만 가입 버튼 활성.
  - 이미 있는 이름/이메일 → "이미 사용 중", 직접 API 중복 이름 register → 409.
  - `/signin`: 비밀번호 눈 토글.

> 포트는 다른 세션 스택과 조율(이전처럼 3100/8081). 단위/타입/빌드로 충분, 라이브는 선택.

---

## Self-Review (작성자 체크 결과)

- **스펙 커버리지**: 소셜제거(T5) ✓, displayName 유니크(T1 인덱스 + T2 repo + T3 register/availability) ✓, 이메일 형식/중복(T2 EmailFormat + T3 register + T4 check-email) ✓, availability 엔드포인트+프록시(T4+T7) ✓, PasswordInput 눈토글 가입·로그인(T6+T8) ✓, 비번 확인 일치(T8) ✓, 제출 게이팅(T8) ✓.
- **플레이스홀더**: 모든 단계 실제 코드. 없음.
- **타입 일관성**: 백엔드 `EmailAvailability{valid,available}` ↔ check-email JSON `{valid,available}` ↔ 프록시 ↔ 프론트 `{valid,available}` 사용 일치. check-name `{available}` 일치. `existsByDisplayNameIgnoreCase`/`existsByEmail` 일관 사용. `isDisplayNameAvailable`/`checkEmail` 시그니처 일치. 프론트 `Avail` 상태(ok/taken/invalid/checking/idle) 일관.
- **검증 도구**: EmailFormatTest=순수 JUnit, AuthService/ControllerTest=testcontainers(Docker), 프론트=typecheck/build.
- **주의**: (1) V8 유니크는 기존 중복 display_name 있으면 실패 → 라이브 전 정리(T9). (2) 같은 테스트 내 register displayName 중복 금지(T3/T4에서 distinct 화). (3) register 이메일 중복은 기존 noop 유지(availability가 UX).
