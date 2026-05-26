# 회원가입 카드 재설계 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/signup`을 Manyfast 스타일 중앙 카드(라벨-위/입력-아래 + 약관 동의 UI)로 재설계하되 기존 기능(이름·이메일 실시간 확인, 비번 체크리스트, 눈 토글, 일치검사, 게이팅)은 모두 유지한다.

**Architecture:** 프론트 전용. 신규 `Checkbox` UI + `TermsAgreement`(UI만, 필수 동의 게이팅) + `CredentialsForm` register 모드 라벨/약관/게이팅 추가 + `signup/page.tsx` 카드 레이아웃. login 모드·`/signin`·백엔드 무변경.

**Tech Stack:** Next.js/TS, Tailwind(기존 토큰: primary/surface/border/success/destructive, text-h3/body-sm/caption), lucide-react. 검증: `npm run typecheck && npm run build` + 라이브(워크트리 스택, 격리 DB).

**관련 설계:** `docs/superpowers/specs/2026-05-26-signup-card-redesign-design.md`. 작업 공간: 격리 워크트리 `worktree-auth-signup-validation`.

---

## 파일 구조

```
web/components/ui/checkbox.tsx          (신규) 네이티브 체크박스 래퍼
web/components/auth/TermsAgreement.tsx  (신규) 약관 동의 박스 (UI만)
web/components/auth/CredentialsForm.tsx (수정) register 라벨 + 약관 + 게이팅 + 버튼문구
web/app/(auth)/signup/page.tsx          (수정) 카드 레이아웃 + 로고 + 헤딩 + 푸터
```

---

## Task 1: Checkbox UI 컴포넌트

**Files:**
- Create: `web/components/ui/checkbox.tsx`

- [ ] **Step 1: 작성**

```tsx
import * as React from "react";

import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        "h-4 w-4 shrink-0 cursor-pointer rounded border-border accent-primary",
        className,
      )}
      {...props}
    />
  ),
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
```

- [ ] **Step 2: 타입체크 + 커밋**

Run: `cd web && npm run typecheck`
Expected: 에러 없음

```bash
git add web/components/ui/checkbox.tsx
git commit -m "feat(web-ui): Checkbox 컴포넌트"
```

---

## Task 2: TermsAgreement 컴포넌트 (약관 동의, UI만)

**Files:**
- Create: `web/components/auth/TermsAgreement.tsx`

- [ ] **Step 1: 작성**

```tsx
"use client";

import { useEffect, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";

type Terms = {
  tos: boolean;
  privacy: boolean;
  age14: boolean;
  marketing: boolean;
};

const INITIAL: Terms = { tos: false, privacy: false, age14: false, marketing: false };

export function TermsAgreement({ onChange }: { onChange: (requiredAccepted: boolean) => void }) {
  const [terms, setTerms] = useState<Terms>(INITIAL);

  const allChecked = terms.tos && terms.privacy && terms.age14 && terms.marketing;
  const requiredAccepted = terms.tos && terms.privacy && terms.age14;

  useEffect(() => {
    onChange(requiredAccepted);
  }, [requiredAccepted, onChange]);

  const toggle = (key: keyof Terms) => setTerms((t) => ({ ...t, [key]: !t[key] }));
  const toggleAll = () => {
    const next = !allChecked;
    setTerms({ tos: next, privacy: next, age14: next, marketing: next });
  };

  return (
    <div className="space-y-2">
      <p className="text-body-sm font-medium">서비스 이용을 위해 약관에 동의해 주세요</p>
      <div className="space-y-3 rounded-lg border border-border p-4">
        <label className="flex cursor-pointer items-center gap-2 font-medium">
          <Checkbox checked={allChecked} onChange={toggleAll} />
          <span>모두 동의합니다.</span>
        </label>

        <div className="space-y-2 border-t border-border pt-3">
          <TermsRow label="(필수) 서비스 이용약관 동의" checked={terms.tos} onToggle={() => toggle("tos")} withLink />
          <TermsRow label="(필수) 개인정보 수집 및 이용 동의" checked={terms.privacy} onToggle={() => toggle("privacy")} withLink />
          <TermsRow label="(선택) 마케팅 정보 수신 및 프로모션 안내 동의" checked={terms.marketing} onToggle={() => toggle("marketing")} withLink />
          <TermsRow label="만 14세 이상입니다." checked={terms.age14} onToggle={() => toggle("age14")} />
        </div>
      </div>
    </div>
  );
}

function TermsRow({
  label,
  checked,
  onToggle,
  withLink = false,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  withLink?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-body-sm">
      <label className="flex cursor-pointer items-center gap-2">
        <Checkbox checked={checked} onChange={onToggle} />
        <span>{label}</span>
      </label>
      {withLink && (
        <button type="button" className="shrink-0 text-caption text-muted-foreground underline">
          전체보기
        </button>
      )}
    </div>
  );
}
```

참고: 부모는 `onChange`에 `setTermsOk`(useState setter, 안정적 참조)를 넘김 → effect는 `requiredAccepted` 변할 때만 통지. `전체보기`는 현재 no-op 플레이스홀더(추후 모달/페이지 연결).

- [ ] **Step 2: 타입체크 + 커밋**

Run: `cd web && npm run typecheck`
Expected: 에러 없음

```bash
git add web/components/auth/TermsAgreement.tsx
git commit -m "feat(web-auth): TermsAgreement 약관 동의 섹션 (UI만, 필수 게이팅)"
```

---

## Task 3: CredentialsForm — register 라벨 + 약관 + 게이팅

**Files:**
- Modify: `web/components/auth/CredentialsForm.tsx`

- [ ] **Step 1: 전체 교체**

`web/components/auth/CredentialsForm.tsx` 를 아래로 교체. (shared 로직 유지 + register 상태 `termsOk` 추가 + 게이팅 `&& termsOk` + return을 register/login 두 분기로 분리. login 분기는 기존과 동일하게 동작.)

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { PasswordChecklist } from "@/components/auth/PasswordChecklist";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { TermsAgreement } from "@/components/auth/TermsAgreement";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkPassword, isPasswordValid } from "@/lib/password";

type Mode = "login" | "register";
type Avail = "idle" | "checking" | "ok" | "taken" | "invalid" | "error";

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
  const [termsOk, setTermsOk] = useState(false);

  // 이름 실시간 확인 (register, debounce 500ms)
  useEffect(() => {
    if (mode !== "register") return;
    const n = displayName.trim();
    if (!n) {
      setNameAvail("idle");
      return;
    }
    setNameAvail("checking");
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-name?name=${encodeURIComponent(n)}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          setNameAvail("error");
          return;
        }
        const d = (await res.json()) as { available: boolean };
        setNameAvail(d.available ? "ok" : "taken");
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        setNameAvail("error");
      }
    }, 500);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
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
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-email?email=${encodeURIComponent(e)}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          setEmailAvail("error");
          return;
        }
        const d = (await res.json()) as { valid: boolean; available: boolean };
        setEmailAvail(!d.valid ? "invalid" : d.available ? "ok" : "taken");
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        setEmailAvail("error");
      }
    }, 500);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [email, mode]);

  const pwValid = isPasswordValid(password);
  const pwMatch = password.length > 0 && password === confirm;
  const namePass = nameAvail === "ok" || nameAvail === "error";
  const emailPass = emailAvail === "ok" || emailAvail === "error";
  const canSubmit =
    !pending &&
    (mode === "login" || (namePass && emailPass && pwValid && pwMatch && termsOk));

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
    if (s === "error") return <p className="text-caption text-muted-foreground">지금은 확인할 수 없어요. 가입할 때 확인할게요</p>;
    if (s === "checking") return <p className="text-caption text-muted-foreground">확인 중…</p>;
    return null;
  };

  if (mode === "login") {
    return (
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1">
          <Input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <PasswordInput
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="text-destructive text-body-sm">{error}</p>}
        <Button type="submit" disabled={!canSubmit} className="w-full">
          {pending ? "처리 중…" : "로그인"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="reg-name" className="text-body-sm font-medium">이름</label>
        <Input
          id="reg-name"
          type="text"
          placeholder="이름을 입력해 주세요"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
        />
        {availMsg(nameAvail, "사용 가능한 이름이에요", "이미 사용 중인 이름이에요")}
      </div>

      <div className="space-y-1">
        <label htmlFor="reg-email" className="text-body-sm font-medium">이메일</label>
        <Input
          id="reg-email"
          type="email"
          placeholder="이메일을 입력해 주세요"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {availMsg(emailAvail, "사용 가능한 이메일이에요", "이미 사용 중인 이메일이에요", "이메일 형식이 올바르지 않아요")}
      </div>

      <div className="space-y-1">
        <label htmlFor="reg-password" className="text-body-sm font-medium">비밀번호</label>
        <PasswordInput
          id="reg-password"
          placeholder="비밀번호를 입력해 주세요"
          minLength={10}
          maxLength={72}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <PasswordChecklist checks={checkPassword(password)} />
      </div>

      <div className="space-y-1">
        <label htmlFor="reg-confirm" className="text-body-sm font-medium">비밀번호 확인</label>
        <PasswordInput
          id="reg-confirm"
          placeholder="비밀번호를 한 번 더 입력해 주세요"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        {confirm.length > 0 && !pwMatch && (
          <p className="text-caption text-destructive">비밀번호가 일치하지 않아요</p>
        )}
      </div>

      <TermsAgreement onChange={setTermsOk} />

      {error && <p className="text-destructive text-body-sm">{error}</p>}

      <Button type="submit" disabled={!canSubmit} className="w-full">
        {pending ? "처리 중…" : "계정 만들기"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: 타입체크 + 커밋**

Run: `cd web && npm run typecheck`
Expected: 에러 없음 (TermsAgreement import 해결, label htmlFor↔id 매칭)

```bash
git add web/components/auth/CredentialsForm.tsx
git commit -m "feat(web-auth): 회원가입 폼 라벨 + 약관 동의 + 필수 게이팅 (로그인 무변경)"
```

---

## Task 4: signup 페이지 카드 레이아웃

**Files:**
- Modify: `web/app/(auth)/signup/page.tsx`

- [ ] **Step 1: 교체**

```tsx
import Link from "next/link";
import { Code2 } from "lucide-react";

import { CredentialsForm } from "@/components/auth/CredentialsForm";

export default function SignUpPage() {
  return (
    <div className="mx-auto max-w-md py-10">
      <div className="space-y-6 rounded-lg border border-border bg-surface p-8 shadow-sm">
        <div className="flex flex-col items-center gap-3">
          <Code2 className="h-8 w-8 text-primary" aria-hidden />
          <h1 className="text-center text-h3 font-bold">환영합니다. 계정을 만들어 주세요.</h1>
        </div>
        <CredentialsForm mode="register" />
        <p className="text-center text-body-sm">
          <Link href="/signin" className="font-medium underline">
            로그인 화면으로 이동
          </Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 + 빌드 + 커밋**

Run: `cd web && npm run typecheck && npm run build`
Expected: 성공, `/signup`·`/signin` 빌드

```bash
git add "web/app/(auth)/signup/page.tsx"
git commit -m "feat(web-auth): 회원가입 카드 레이아웃 (로고·헤딩·로그인 이동 링크)"
```

---

## Task 5: 라이브 검증 (워크트리 스택, 격리 DB)

- [ ] 격리 DB(`devjobs_wt`) 생성 → 워크트리 백엔드(8081, `DATABASE_URL=.../devjobs_wt`)+웹(3100, `BACKEND_URL=http://localhost:8081`) 기동.
- [ ] `/signup`:
  - 카드 렌더(로고 아이콘·"환영합니다. 계정을 만들어 주세요."·"로그인 화면으로 이동").
  - 이름/이메일/비밀번호/비밀번호 확인 **라벨** 표시. 실시간 확인·체크리스트·눈 토글 유지.
  - 약관: "모두 동의" 클릭 → 4개 전부 토글, 개별 다 켜면 마스터 자동 on.
  - 게이팅: 폼 다 채워도 **필수 3개 미동의 시 "계정 만들기" 비활성** → 필수 동의 시 활성. (마케팅만 빼도 활성)
  - 가입 end-to-end(성공 메시지).
- [ ] `/signin`: 기존과 동일(무변경) 확인.
- [ ] 검증 후 스택 종료 + `devjobs_wt` DROP.

> 단위 검증 없음(프론트). typecheck/build 필수, 라이브 권장.

---

## Self-Review (작성자 체크)

- **스펙 커버리지**: 카드 레이아웃(T4) ✓, 라벨(T3) ✓, 약관 UI+게이팅(T2+T3) ✓, Checkbox(T1) ✓, 기존 기능 유지(T3 동일 로직) ✓, login 무변경(T3 login 분기 = 기존) ✓.
- **플레이스홀더**: `전체보기` no-op은 의도된 범위(UI만). 그 외 모든 코드 완전.
- **타입 일관성**: `TermsAgreement onChange:(b:boolean)=>void` ↔ 부모 `setTermsOk`(Dispatch<SetStateAction<boolean>> 호환, boolean 인자) ✓. `Checkbox` = input props 패스스루 ✓. label `htmlFor` ↔ Input/PasswordInput `id` 매칭(PasswordInput은 props를 Input에 spread) ✓. `Avail`/availMsg 기존과 동일 ✓.
- **회귀 주의**: login 분기는 기존 마크업/문구 그대로(이메일 div + PasswordInput "비밀번호" + 버튼 "로그인"). 백엔드/register API/`/signin` 페이지 무변경.
