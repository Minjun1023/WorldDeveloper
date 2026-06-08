import Link from "next/link";

import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";
import { BackToHomeLink } from "@/components/auth/BackToHomeLink";
import { CredentialsForm } from "@/components/auth/CredentialsForm";
import { OAuthButtons } from "@/components/auth/OAuthButtons";

const BACKEND_PUBLIC_URL = process.env.BACKEND_PUBLIC_URL ?? "http://localhost:8080";

export default function SignUpPage() {
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <AuthBrandPanel
        heading="해외 취업의 첫걸음"
        subtitle="지금 가입하고 비자 스폰서 공고를 찾아보세요."
      />

      {/* 우측 폼 */}
      <div className="relative flex items-center justify-center px-6 py-16 sm:px-10">
        <BackToHomeLink />
        <div className="w-full max-w-sm">
          <h1 className="text-h1">회원가입</h1>
          <p className="mt-2 text-body-sm text-muted-foreground">
            EU 테크 커리어를 위한 첫걸음을 시작하세요.
          </p>

          <div className="mt-6">
            <CredentialsForm mode="register" />
          </div>

          <div className="my-5 flex items-center gap-3 text-caption text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            또는
            <span className="h-px flex-1 bg-border" />
          </div>

          <OAuthButtons backendPublicUrl={BACKEND_PUBLIC_URL} />

          <p className="mt-6 text-center text-body-sm text-muted-foreground">
            이미 계정이 있으신가요?{" "}
            <Link href="/signin" className="font-medium text-primary hover:underline">
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
