import { Lock } from "lucide-react";
import Link from "next/link";

import { SectionHeader } from "@/components/home/SectionHeader";
import { RecommendationCard } from "@/components/recommend/RecommendationCard";
import type { Job, RecommendationItem } from "@/lib/types";

// 로그인 전 데모용 예시 점수 — 실제 개인화 점수 아님. 카드는 블러 배경으로만 노출(잠금 상태).
const SAMPLE_SCORES = [
  {
    final_score: 0.92, stack: 0.95, visa: 1, location: 0.9, seniority: 0.86, salary: 0.78, semantic: 0.9,
    penalty_applied: 0, reasons: ["보유 스택과 정확히 일치", "비자 스폰서 명시됨"], deal_breakers: [],
  },
  {
    final_score: 0.88, stack: 0.9, visa: 1, location: 0.84, seniority: 0.82, salary: 0.8, semantic: 0.85,
    penalty_applied: 0, reasons: ["원격 근무 가능", "기술 키워드 다수 일치"], deal_breakers: [],
  },
  {
    final_score: 0.85, stack: 0.82, visa: 1, location: 0.88, seniority: 0.8, salary: 0.74, semantic: 0.83,
    penalty_applied: 0, reasons: ["희망 지역과 일치", "시니어 레벨 부합"], deal_breakers: [],
  },
];

// 비로그인 홈: "당신을 위한 6차원 매칭 공고"를 블러 처리한 잠금 미리보기로 노출.
// 카드는 장식용 배경(블러·비활성)이고, 중앙 CTA로 프로필 작성을 유도한다.
// 로그인 시엔 page.tsx 가 <MemberLandingRecommend/>(실제 추천)로 교체한다.
export function SampleRecommend({ jobs }: { jobs: Job[] }) {
  if (jobs.length === 0) return null;

  const items = jobs.slice(0, 3).map((job, i) => ({
    job,
    score: SAMPLE_SCORES[i % SAMPLE_SCORES.length],
  })) as unknown as RecommendationItem[];

  return (
    <div>
      <SectionHeader
        overline="AI 맞춤 추천"
        title="당신을 위한 6차원 매칭 공고"
        subtitle="프로필을 작성하면 스택·비자·지역·레벨·연봉·의미 6축 점수로 내게 맞는 공고를 추천해드려요."
      />
      <div className="relative">
        {/* 잠금된 미리보기 — 카드를 블러 처리한 배경(장식, 상호작용 비활성) */}
        <div
          aria-hidden="true"
          className="grid select-none gap-4 blur-[5px] pointer-events-none sm:grid-cols-2 lg:grid-cols-3"
        >
          {items.map((item, i) => (
            <RecommendationCard key={item.job.id} item={item} rank={i + 1} />
          ))}
        </div>

        {/* 중앙 CTA 오버레이 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-surface/40 px-4 text-center">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-body-sm font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Lock className="h-4 w-4" aria-hidden="true" />
            프로필 작성 시 이용 가능
          </Link>
          <p className="text-body-sm font-medium text-foreground">
            프로필을 작성하면 내 기준 맞춤 추천을 볼 수 있어요.
          </p>
        </div>
      </div>
    </div>
  );
}
