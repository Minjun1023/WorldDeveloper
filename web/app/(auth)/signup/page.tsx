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
