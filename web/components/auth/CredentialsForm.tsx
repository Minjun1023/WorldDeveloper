"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { PasswordChecklist } from "@/components/auth/PasswordChecklist";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { TermsAgreement } from "@/components/auth/TermsAgreement";
import { ProfileForm } from "@/components/recommend/ProfileForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkPassword, isPasswordValid } from "@/lib/password";
import type { RecommendProfile } from "@/lib/types";

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
  const [regStep, setRegStep] = useState<"account" | "profile">("account");

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

  async function doRegister(profile?: RecommendProfile) {
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
          profile: profile ?? null,
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
      // 계정 필드 검증은 canSubmit 게이트(이름/이메일/비번/확인/약관)를 통과해야 여기 도달.
      // 네트워크 호출 대신 프로필 단계로 진행한다.
      setRegStep("profile");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.status === 403) throw new Error("이메일 인증이 필요해요. 받은 인증 메일의 링크를 눌러주세요.");
      if (!res.ok) throw new Error("이메일 또는 비밀번호가 올바르지 않아요.");
      router.push(callbackUrl);
      router.refresh();
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

  if (mode === "register" && regStep === "profile") {
    return (
      <div className="space-y-3">
        <p className="text-body-sm text-muted-foreground">맞춤 공고 추천을 위한 프로필 (선택 — 건너뛰어도 가입돼요)</p>
        <ProfileForm
          loading={pending}
          submitLabel="가입 완료"
          onSubmit={(profile) => doRegister(profile)}
          secondaryAction={
            <button
              type="button"
              onClick={() => doRegister(undefined)}
              className="text-body-sm text-muted-foreground hover:text-foreground"
            >
              건너뛰기
            </button>
          }
        />
        {error && <p className="text-destructive text-body-sm">{error}</p>}
      </div>
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
        {pending ? "처리 중…" : "다음"}
      </Button>
    </form>
  );
}
