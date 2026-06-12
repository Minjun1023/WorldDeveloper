import { SectionHeader } from "@/components/home/SectionHeader";
import { RecommendationCard } from "@/components/recommend/RecommendationCard";
import type { Job, RecommendationItem } from "@/lib/types";

// 로그인 전 데모용 예시 점수 — 실제 개인화 점수 아님(헤더에 "예시"/"로그인 시 개인화" 명시).
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

// 비로그인 홈: "당신을 위한 6차원 매칭 공고"를 예시(샘플 공고 + 예시 점수) 3열 그리드로 노출.
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
        overline="맞춤 추천 미리보기"
        title="당신을 위한 6차원 매칭 공고"
        href="/signin"
        hrefLabel="로그인하고 내 추천 보기"
        subtitle="프로필 기반으로 스택·비자·지역·레벨·연봉·의미 6축 점수를 계산해요. 육각형이 클수록 매칭도가 높아요. 아래는 예시이며, 로그인하면 내 기준으로 추천해드려요."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => (
          <RecommendationCard key={item.job.id} item={item} rank={i + 1} />
        ))}
      </div>
    </div>
  );
}
