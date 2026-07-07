import { Sparkles } from "lucide-react";
import Link from "next/link";

import { JobCard } from "@/components/job/JobCard";
import { buttonVariants } from "@/components/ui/button";
import type { Job } from "@/lib/types";
import { cn } from "@/lib/utils";

// 맞춤 추천 잠금 티저 — 실공고 카드를 블러 처리해 "여기에 내 추천이 온다"를 보여주고,
// 상태에 따라 CTA 를 분기한다(비로그인 → 로그인, 프로필 미작성 → 프로필 작성).
// 중앙 오버레이 패널이 뚜렷해 블러가 '고장'이 아니라 '잠김'으로 읽힌다.
const COPY = {
  signin: {
    title: "로그인하면 나에게 맞는 공고를 추천해드려요",
    sub: "스택·지역·레벨·연봉·의미 5축 매칭으로 승인 확률 높은 공고를 골라드려요.",
    href: "/signin?callbackUrl=/recommend",
  },
  profile: {
    title: "프로필을 작성하면 5축 매칭 추천을 받을 수 있어요",
    sub: "스택·지역·레벨·연봉·의미 기준으로 승인 확률 높은 공고를 골라드려요.",
    href: "/me/profile",
  },
} as const;

export function LockedRecommendPreview({
  mode,
  jobs,
}: {
  mode: keyof typeof COPY;
  jobs: Job[];
}) {
  const copy = COPY[mode];
  const teasers = jobs.slice(0, 3);

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* 블러 티저 — 실공고 카드(읽기/클릭 차단, 스크린리더 제외) */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none blur-[6px]"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teasers.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
          {/* 공고가 부족해도(백엔드 일시 장애 등) 오버레이 높이 유지용 플레이스홀더 */}
          {Array.from({ length: Math.max(0, 3 - teasers.length) }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl border border-border bg-card p-4">
              <div className="h-4 w-2/3 rounded bg-muted" />
              <div className="mt-3 h-3 w-1/2 rounded bg-muted" />
              <div className="mt-6 flex gap-1.5">
                <div className="h-5 w-14 rounded-full bg-muted" />
                <div className="h-5 w-14 rounded-full bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 중앙 잠금 오버레이 */}
      <div className="absolute inset-0 flex items-center justify-center bg-background/50">
        <div className="mx-4 flex max-w-md flex-col items-center rounded-xl border border-border bg-background/95 px-8 py-7 text-center shadow-lg">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="mt-3 text-body font-bold text-foreground">{copy.title}</p>
          <p className="mt-1 text-body-sm text-muted-foreground">{copy.sub}</p>
          <Link href={copy.href} className={cn(buttonVariants(), "mt-4")}>
            맞춤 추천 받기
          </Link>
        </div>
      </div>
    </div>
  );
}
