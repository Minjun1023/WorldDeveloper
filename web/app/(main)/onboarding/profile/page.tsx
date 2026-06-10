import { Code2 } from "lucide-react";
import { redirect } from "next/navigation";

import { OnboardingProfile } from "@/components/profile/OnboardingProfile";
import { getSession } from "@/lib/session-server";

export const dynamic = "force-dynamic";

export default async function OnboardingProfilePage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  return (
    <div className="mx-auto max-w-md py-10">
      <div className="space-y-6 rounded-lg border border-border bg-surface p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col items-center gap-3">
          <Code2 className="h-8 w-8 text-primary" aria-hidden />
          <h1 className="text-center text-h3 font-bold">환영합니다! 거의 다 됐어요.</h1>
        </div>
        <OnboardingProfile />
        <p className="text-center text-caption text-muted-foreground">
          비자 스폰서십은 기본 포함돼요.
        </p>
      </div>
    </div>
  );
}
