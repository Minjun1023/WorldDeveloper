"use client";

import { Lock, Mail, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { PasswordChecklist } from "@/components/auth/PasswordChecklist";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { TermsAgreement } from "@/components/auth/TermsAgreement";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkPassword, isPasswordValid } from "@/lib/password";
import { safeInternalPath } from "@/lib/safe-redirect";

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
  const [emailAlerts, setEmailAlerts] = useState(true); // 이메일 알림 수신 — 기본 허용(동의창에서 해제 가능)
  const [remember, setRemember] = useState(true);
  // 이메일 인증번호(코드) 입력 단계 → 인증 완료 시 프로필 단계
  const [code, setCode] = useState("");
  const [verifyPending, setVerifyPending] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

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

  // 계정 정보만으로 가입 → 인증번호 발송. 프로필은 인증 완료 후 별도 단계에서 저장한다.
  async function doRegister() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          display_name: displayName.trim(),
          profile: null,
          email_alerts: emailAlerts,
        }),
      });
      if (!res.ok) throw new Error("가입에 실패했어요. 입력을 확인해 주세요.");
      setRegistered(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했어요.");
    } finally {
      setPending(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "register") {
      // 계정 필드 검증(canSubmit) 통과 → 가입 + 인증번호 발송. 인증 후 프로필 단계로 이어진다.
      void doRegister();
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, remember }),
      });
      if (res.status === 403) throw new Error("이메일 인증이 필요해요. 회원가입 시 받은 인증번호로 인증해 주세요.");
      if (!res.ok) throw new Error("이메일 또는 비밀번호가 올바르지 않아요.");
      router.push(safeInternalPath(callbackUrl));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했어요.");
    } finally {
      setPending(false);
    }
  }

  async function resend() {
    setVerifyError(null);
    setResent(false);
    setCode("");
    await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setResent(true);
  }

  // 인증번호 확인 → 성공 시 입력한 자격으로 자동 로그인하여 바로 입장.
  async function verifyCode() {
    setVerifyError(null);
    setVerifyPending(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code: code.trim() }),
      });
      if (res.status === 429) throw new Error("시도가 너무 많아요. 잠시 후 다시 시도해 주세요.");
      if (!res.ok) throw new Error("인증번호가 올바르지 않거나 만료됐어요.");
      const login = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, remember: true }),
      });
      if (!login.ok) {
        router.push("/signin"); // 자동 로그인 실패 시 로그인 화면으로
        return;
      }
      // 인증·자동로그인 완료 → 입장. 인라인 프로필 단계는 폐기 —
      // 특정 페이지에서 온 유저(callbackUrl)는 보던 곳으로, 그 외엔 완성형 프로필 편집(환영 모드)으로.
      const dest = callbackUrl && callbackUrl !== "/"
        ? safeInternalPath(callbackUrl)
        : "/me/profile?welcome=1";
      router.push(dest);
      router.refresh();
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "오류가 발생했어요.");
    } finally {
      setVerifyPending(false);
    }
  }

  if (mode === "register" && registered) {
    return (
      <div className="space-y-4">
        <p className="text-body-sm">
          <strong>{email}</strong> 로 6자리 인증번호를 보냈어요. 메일을 확인하고 아래에 입력해 주세요. (10분 이내 유효)
        </p>
        <div className="space-y-1.5">
          <label htmlFor="verify-code" className="text-body-sm font-medium">인증번호</label>
          <Input
            id="verify-code"
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="6자리 숫자"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="h-11 text-center text-lg tracking-[0.4em]"
          />
        </div>
        {verifyError && <p className="text-destructive text-body-sm">{verifyError}</p>}
        {resent && !verifyError && (
          <p className="text-caption text-success">인증번호를 다시 보냈어요.</p>
        )}
        <Button
          type="button"
          onClick={verifyCode}
          disabled={verifyPending || code.length !== 6}
          className="h-11 w-full"
        >
          {verifyPending ? "확인 중…" : "인증하기"}
        </Button>
        <button type="button" onClick={resend} className="text-body-sm text-primary underline">
          인증번호 다시 보내기
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
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="login-email" className="text-body-sm font-medium">
            이메일
          </label>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="login-email"
              autoComplete="email"
              type="email"
              placeholder="hello@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11 pl-10"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="login-password" className="text-body-sm font-medium">
              비밀번호
            </label>
            <Link href="/forgot-password" className="text-caption text-primary hover:underline">
              비밀번호 찾기
            </Link>
          </div>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <PasswordInput
              id="login-password"
              autoComplete="current-password"
              placeholder="비밀번호를 입력하세요"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-11 pl-10"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-body-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-[hsl(var(--primary))]"
          />
          로그인 상태 유지
        </label>

        {error && <p className="text-destructive text-body-sm">{error}</p>}
        <Button type="submit" disabled={!canSubmit} className="h-11 w-full">
          {pending ? "처리 중…" : "로그인"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="reg-name" className="text-body-sm font-medium">이름</label>
        <div className="relative">
          <User
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="reg-name"
            type="text"
            placeholder="홍길동"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            className="h-11 pl-10"
          />
        </div>
        {availMsg(nameAvail, "사용 가능한 이름이에요", "이미 사용 중인 이름이에요")}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="reg-email" className="text-body-sm font-medium">이메일</label>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="reg-email"
            autoComplete="email"
            type="email"
            placeholder="hello@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-11 pl-10"
          />
        </div>
        {availMsg(emailAvail, "사용 가능한 이메일이에요", "이미 사용 중인 이메일이에요", "이메일 형식이 올바르지 않아요")}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="reg-password" className="text-body-sm font-medium">비밀번호</label>
        <div className="relative">
          <Lock
            className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <PasswordInput
            id="reg-password"
            autoComplete="new-password"
            placeholder="영문 대·소문자, 숫자 포함 10자 이상"
            minLength={10}
            maxLength={72}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="h-11 pl-10"
          />
        </div>
        <PasswordChecklist checks={checkPassword(password)} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="reg-confirm" className="text-body-sm font-medium">비밀번호 확인</label>
        <div className="relative">
          <Lock
            className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <PasswordInput
            id="reg-confirm"
            autoComplete="new-password"
            placeholder="비밀번호를 다시 입력해주세요"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            className="h-11 pl-10"
          />
        </div>
        {confirm.length > 0 && !pwMatch && (
          <p className="text-caption text-destructive">비밀번호가 일치하지 않아요</p>
        )}
      </div>

      <TermsAgreement onChange={setTermsOk} onEmailAlertsChange={setEmailAlerts} />

      {error && <p className="text-destructive text-body-sm">{error}</p>}

      <Button type="submit" disabled={!canSubmit} className="h-11 w-full">
        {pending ? "처리 중…" : "인증번호 받기"}
      </Button>
    </form>
  );
}
