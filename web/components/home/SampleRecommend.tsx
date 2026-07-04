import { Sparkles } from "lucide-react";
import Link from "next/link";

// 비로그인 홈: 맞춤 추천은 블러 카드 3장(~500px) 대신 컴팩트한 1줄 CTA 배너로.
// 큰 블러 영역은 첫 방문자에게 '고장/쓸모없음' 신호를 줘서 인기 공고에 공간을 양보한다.
// 로그인 시엔 page.tsx 가 <MemberLandingRecommend/>(실제 추천)로 교체한다.
export function SampleRecommend() {
  return (
    <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-primary-tint px-6 py-5 sm:flex-row">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-body font-bold text-foreground">
            프로필을 작성하면 5축 매칭 추천을 받을 수 있어요
          </p>
          <p className="mt-0.5 text-body-sm text-muted-foreground">
            스택·지역·레벨·연봉·의미 기준으로 승인 확률 높은 공고를 골라드려요.
          </p>
        </div>
      </div>
      <Link
        href="/signin?callbackUrl=/recommend"
        className="shrink-0 rounded-xl bg-primary px-5 py-2.5 text-body-sm font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        맞춤 추천 받기 →
      </Link>
    </div>
  );
}
