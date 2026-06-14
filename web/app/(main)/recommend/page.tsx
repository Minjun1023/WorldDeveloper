import Link from "next/link";

import { MemberRecommend } from "@/components/recommend/MemberRecommend";
import { getSession } from "@/lib/session-server";

export const dynamic = "force-dynamic";

export default async function RecommendPage({
  searchParams,
}: {
  searchParams: { note?: string };
}) {
  const session = await getSession();
  // 히어로 '맞춤 매칭'에서 조건을 들고 진입(?note=)하면 MemberRecommend 가 마운트 시 1회 적용한다.
  const initialNote = typeof searchParams?.note === "string" ? searchParams.note : undefined;

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-display">맞춤 추천</h1>
        <p className="mt-2 text-muted-foreground">
          프로필(기술스택·경력·선호 조건)을 기반으로 6차원 점수(스택·비자·지역·레벨·연봉·의미)로 추천해요.
        </p>
      </section>

      {session ? (
        <MemberRecommend initialNote={initialNote} />
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
