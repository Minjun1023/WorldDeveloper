import Link from "next/link";

import { MemberRecommend } from "@/components/recommend/MemberRecommend";
import { getSession } from "@/lib/session-server";

export const dynamic = "force-dynamic";

export default async function RecommendPage() {
  const session = await getSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1">맞춤 추천</h1>
        <p className="mt-2 max-w-2xl text-body text-muted-foreground">
          내 프로필을{" "}
          <strong className="font-semibold text-foreground">5축(스택·지역·레벨·연봉·의미)</strong>으로
          매칭해 승인 가능성이 높은 비자 스폰서 공고부터 보여드립니다.
        </p>
      </div>
      {session ? (
        <MemberRecommend />
      ) : (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <h2 className="text-h3">로그인하고 맞춤 공고 추천 받기</h2>
          <p className="mx-auto mt-2 max-w-md text-body-sm text-muted-foreground">
            가입 시 입력한 프로필로 비자 스폰서 공고를 자동 추천해드려요. 공고 검색은 로그인 없이도 가능합니다.
          </p>
          <Link href="/signin" className="mt-4 inline-block rounded-md bg-primary px-5 py-2.5 text-body-sm font-medium text-primary-foreground">
            로그인 / 회원가입
          </Link>
        </div>
      )}
    </div>
  );
}
