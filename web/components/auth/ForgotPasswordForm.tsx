"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { PasswordChecklist } from "@/components/auth/PasswordChecklist";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkPassword, isPasswordValid } from "@/lib/password";

// 비밀번호 찾기: 1) 이메일로 코드 요청 → 2) 코드 + 새 비밀번호 입력 → 완료 후 로그인 이동.
export function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  const pwValid = isPasswordValid(password);
  const pwMatch = password.length > 0 && password === confirm;

  async function sendCode() {
    setError(null);
    setPending(true);
    try {
      // 계정 열거 방지로 백엔드는 항상 200 → 존재 여부와 무관하게 다음 단계로.
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setStep("reset");
    } catch {
      setError("요청에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  }

  async function resend() {
    setError(null);
    setResent(false);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setResent(true);
  }

  async function submitReset() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code: code.trim(), new_password: password }),
      });
      if (res.status === 429) throw new Error("시도가 너무 많아요. 잠시 후 다시 시도해 주세요.");
      if (!res.ok) throw new Error("인증번호가 올바르지 않거나 만료됐어요.");
      router.push("/signin?reset=1");
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했어요.");
    } finally {
      setPending(false);
    }
  }

  if (step === "request") {
    return (
      <div className="space-y-4">
        <p className="text-body-sm text-muted-foreground">
          가입한 이메일을 입력하면 비밀번호 재설정 인증번호를 보내드려요.
        </p>
        <Input
          type="email"
          placeholder="hello@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11"
        />
        {error && <p className="text-destructive text-body-sm">{error}</p>}
        <Button type="button" onClick={sendCode} disabled={pending || !email.trim()} className="h-11 w-full">
          {pending ? "전송 중…" : "인증번호 받기"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-body-sm">
        <strong>{email}</strong> 로 인증번호를 보냈어요(가입된 계정인 경우). 인증번호와 새 비밀번호를 입력하세요.
      </p>
      <div className="space-y-1.5">
        <label htmlFor="reset-code" className="text-body-sm font-medium">인증번호</label>
        <Input
          id="reset-code"
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
      <div className="space-y-1.5">
        <label htmlFor="reset-pw" className="text-body-sm font-medium">새 비밀번호</label>
        <PasswordInput
          id="reset-pw"
          autoComplete="new-password"
          placeholder="영문 대·소문자, 숫자 포함 10자 이상"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11"
        />
        <PasswordChecklist checks={checkPassword(password)} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="reset-confirm" className="text-body-sm font-medium">새 비밀번호 확인</label>
        <PasswordInput
          id="reset-confirm"
          autoComplete="new-password"
          placeholder="새 비밀번호를 다시 입력"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="h-11"
        />
        {confirm.length > 0 && !pwMatch && (
          <p className="text-caption text-destructive">비밀번호가 일치하지 않아요</p>
        )}
      </div>
      {error && <p className="text-destructive text-body-sm">{error}</p>}
      {resent && !error && <p className="text-caption text-success">인증번호를 다시 보냈어요.</p>}
      <Button
        type="button"
        onClick={submitReset}
        disabled={pending || code.length !== 6 || !pwValid || !pwMatch}
        className="h-11 w-full"
      >
        {pending ? "변경 중…" : "비밀번호 변경"}
      </Button>
      <button type="button" onClick={resend} className="text-body-sm text-primary underline">
        인증번호 다시 보내기
      </button>
    </div>
  );
}
