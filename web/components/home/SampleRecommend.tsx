import { RecommendCarousel } from "@/components/home/RecommendCarousel";
import { RecommendPreviewCard } from "@/components/home/RecommendPreviewCard";
import type { Job, RecommendationItem } from "@/lib/types";

// 로그인 전 데모용 예시 점수 — 실제 개인화 점수 아님(헤더에 "예시"/"로그인 시 이용 가능" 명시).
const SAMPLE_SCORES = [
  {
    final_score: 0.92, stack: 0.95, visa: 1, location: 0.9, seniority: 0.86, salary: 0.78, semantic: 0.9,
    penalty_applied: 0, reasons: ["보유 스택과 정확히 일치, 비자 스폰서 명시됨"], deal_breakers: [],
  },
  {
    final_score: 0.88, stack: 0.9, visa: 1, location: 0.84, seniority: 0.82, salary: 0.8, semantic: 0.85,
    penalty_applied: 0, reasons: ["원격 근무 가능, 기술 키워드 다수 일치"], deal_breakers: [],
  },
  {
    final_score: 0.85, stack: 0.82, visa: 1, location: 0.88, seniority: 0.8, salary: 0.74, semantic: 0.83,
    penalty_applied: 0, reasons: ["희망 지역과 일치, 시니어 레벨 부합"], deal_breakers: [],
  },
];

// 비로그인 홈: "당신을 위한 6차원 매칭 공고"를 예시(샘플 공고 + 예시 점수)로 캐러셀에 보여줌.
export function SampleRecommend({ jobs }: { jobs: Job[] }) {
  if (jobs.length === 0) return null;

  const items = jobs.map((job, i) => ({
    job,
    score: SAMPLE_SCORES[i % SAMPLE_SCORES.length],
  })) as unknown as RecommendationItem[];

  return (
    <RecommendCarousel>
      {items.map((item) => (
        <div key={item.job.id} className="w-[300px] shrink-0 snap-start sm:w-[340px]">
          <RecommendPreviewCard item={item} />
        </div>
      ))}
    </RecommendCarousel>
  );
}
