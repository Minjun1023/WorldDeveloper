import Link from "next/link";

import { CredentialsForm } from "@/components/auth/CredentialsForm";
import { OAuthButtons } from "@/components/auth/OAuthButtons";

const BACKEND_PUBLIC_URL = process.env.BACKEND_PUBLIC_URL ?? "http://localhost:8080";

export default function SignInPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string; error?: string };
}) {
  const callbackUrl = searchParams.callbackUrl ?? "/";
  return (
    <div className="mx-auto max-w-sm space-y-6 py-8">
      <h1 className="text-display">로그인</h1>
      {searchParams.error === "oauth" && (
        <p className="text-destructive text-body-sm">소셜 로그인에 실패했어요. 다시 시도해 주세요.</p>
      )}
      <OAuthButtons backendPublicUrl={BACKEND_PUBLIC_URL} />
      <div className="text-center text-caption text-muted-foreground">또는</div>
      <CredentialsForm mode="login" callbackUrl={callbackUrl} />
      <p className="text-body-sm text-muted-foreground">
        계정이 없나요?{" "}
        <Link href="/signup" className="text-primary underline">
          회원가입
        </Link>
      </p>
    </div>
  );
}
