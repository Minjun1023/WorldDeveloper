import Link from "next/link";
import { Code2 } from "lucide-react";

import { CredentialsForm } from "@/components/auth/CredentialsForm";

export default function SignUpPage() {
  return (
    <div className="mx-auto max-w-md py-10">
      <div className="space-y-6 rounded-lg border border-border bg-surface p-6 sm:p-8 shadow-sm">
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
