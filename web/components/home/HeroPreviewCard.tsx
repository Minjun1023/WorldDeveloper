import { MapPin } from "lucide-react";
import Link from "next/link";

import { ScoreRadar } from "@/components/recommend/ScoreRadar";
import type { RecommendationItem } from "@/lib/types";

// 히어로 우측 "6차원 매칭 미리보기" 카드: 작은 레이더 + 예시 공고 + 추천 전체 보기.
// 실제 공고 + 예시 점수(개인화 아님)로 보여주는 일러스트성 미리보기.
export function HeroPreviewCard({ item }: { item: RecommendationItem }) {
  const { job, score } = item;
  const loc = [job.location, job.is_remote ? "원격" : null].filter(Boolean).join(" · ");

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-caption font-medium text-muted-foreground">6차원 매칭 미리보기</span>
        <span className="rounded-md bg-primary px-2 py-0.5 text-caption font-semibold text-primary-foreground">
          {Math.round(score.final_score * 100)}점
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="shrink-0">
          <ScoreRadar score={score} size={116} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-body-sm font-semibold leading-snug text-foreground">
            {job.title_ko ?? job.title}
          </p>
          <p className="mt-1 flex items-center gap-1 text-caption text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {job.company.display_name}
              {loc ? ` · ${loc}` : ""}
            </span>
          </p>
          <Link
            href="/recommend"
            className="mt-2 inline-flex items-center gap-1 text-caption font-medium text-primary transition-colors hover:underline"
          >
            추천 전체 보기
          </Link>
        </div>
      </div>
    </div>
  );
}
