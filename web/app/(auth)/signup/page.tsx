import Link from "next/link";

import { CredentialsForm } from "@/components/auth/CredentialsForm";
import { OAuthButtons } from "@/components/auth/OAuthButtons";

const BACKEND_PUBLIC_URL = process.env.BACKEND_PUBLIC_URL ?? "http://localhost:8080";

export default function SignUpPage() {
  return (
    <div className="mx-auto max-w-sm space-y-6 py-8">
      <h1 className="text-display">회원가입</h1>
      <OAuthButtons backendPublicUrl={BACKEND_PUBLIC_URL} />
      <div className="text-center text-caption text-muted-foreground">또는 이메일로 가입</div>
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
