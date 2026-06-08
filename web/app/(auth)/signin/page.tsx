import Link from "next/link";

import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";
import { BackToHomeLink } from "@/components/auth/BackToHomeLink";
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
    <div className="grid min-h-screen md:grid-cols-2">
      <AuthBrandPanel
        heading="돌아오신 걸 환영합니다"
        subtitle="EU 테크 커리어의 모든 가능성이 여기 있어요."
      />

      {/* 우측 폼 */}
      <div className="relative flex items-center justify-center px-6 py-16 sm:px-10">
        <BackToHomeLink />
        <div className="w-full max-w-sm">
          <h1 className="text-h1">로그인</h1>
          <p className="mt-2 text-body-sm text-muted-foreground">
            계정에 로그인하고 맞춤 공고를 확인하세요.
          </p>

          {searchParams.error === "oauth" && (
            <p className="mt-4 text-body-sm text-destructive">
              소셜 로그인에 실패했어요. 다시 시도해 주세요.
            </p>
          )}

          <div className="mt-6">
            <CredentialsForm mode="login" callbackUrl={callbackUrl} />
          </div>

          <div className="my-5 flex items-center gap-3 text-caption text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            또는
            <span className="h-px flex-1 bg-border" />
          </div>

          <OAuthButtons backendPublicUrl={BACKEND_PUBLIC_URL} />

          <p className="mt-6 text-center text-body-sm text-muted-foreground">
            아직 계정이 없으신가요?{" "}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              회원가입
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
