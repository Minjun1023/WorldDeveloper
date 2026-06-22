import Link from "next/link";

import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";
import { BackToHomeLink } from "@/components/auth/BackToHomeLink";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <AuthBrandPanel
        heading="비밀번호를 잊으셨나요?"
        subtitle="이메일 인증으로 안전하게 재설정하세요."
      />

      <div className="relative flex items-center justify-center px-6 py-16 sm:px-10">
        <BackToHomeLink />
        <div className="w-full max-w-sm">
          <h1 className="text-h1">비밀번호 찾기</h1>
          <p className="mt-2 text-body-sm text-muted-foreground">
            이메일로 받은 인증번호로 새 비밀번호를 설정해요.
          </p>

          <div className="mt-6">
            <ForgotPasswordForm />
          </div>

          <p className="mt-6 text-center text-body-sm text-muted-foreground">
            비밀번호가 기억나셨나요?{" "}
            <Link href="/signin" className="font-medium text-primary hover:underline">
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
