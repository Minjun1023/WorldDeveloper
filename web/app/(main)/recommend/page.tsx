export const metadata = {
  title: "맞춤 공고 추천 | DevPass",
  description: "내 프로필 기반 5축 매칭 점수로 승인 확률 높은 해외 공고를 추천받으세요.",
};

import Link from "next/link";

import { MemberRecommend } from "@/components/recommend/MemberRecommend";
import { buttonVariants } from "@/components/ui/button";
import { getSession } from "@/lib/session-server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RecommendPage() {
  const session = await getSession();

  return (
    <div className="space-y-6">
      <h1 className="text-h1">맞춤 공고 추천</h1>
      {session ? (
        <MemberRecommend />
      ) : (
        <div className="rounded-lg border border-border bg-surface p-6 text-center">
          <h2 className="text-h3">로그인하고 맞춤 공고 추천 받기</h2>
          <p className="mx-auto mt-2 max-w-md text-body-sm text-muted-foreground">
            가입 시 입력한 프로필로 비자 스폰서 공고를 자동 추천해드려요. 공고 검색은 로그인 없이도 가능합니다.
          </p>
          <Link href="/signin" className={cn(buttonVariants(), "mt-4")}>
            로그인 / 회원가입
          </Link>
        </div>
      )}
    </div>
  );
}
