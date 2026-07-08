import { CountUp } from "@/components/home/CountUp";
import type { HomeStats } from "@/components/home/HeroStats";

// 히어로 바로 아래 전폭 통계 띠(스폰서십 명시 공고 · 정부 명부 검증 공고 · 검증된 회사 · 진출 국가).
export function StatsBand({ stats }: { stats: HomeStats }) {
  const items = [
    { value: stats.sponsors, label: "스폰서십 명시 공고" },
    { value: stats.verified, label: "정부 명부 검증 공고" },
    { value: stats.companies, label: "검증된 회사" },
    { value: stats.countries, label: "진출 국가" },
  ].filter((i) => i.value > 0);

  if (items.length === 0) return null;

  return (
    <section className="section-muted border-y border-border">
      <div className="mx-auto grid max-w-container grid-cols-2 gap-y-6 px-4 py-8 sm:grid-cols-4 sm:divide-x sm:divide-border">
        {items.map((i) => (
          <div key={i.label} className="px-4 text-center sm:text-left">
            <div className="text-[1.75rem] font-bold leading-none tabular-nums text-foreground">
              <CountUp value={i.value} />
            </div>
            <div className="mt-1.5 text-body-sm text-muted-foreground">{i.label}</div>
          </div>
        ))}
      </div>
      {/* 데이터 신선도 — 잡보드의 신뢰는 신선도에서 나온다. 전부 실제 파이프라인 사실(ETL 자정 배치·소스 12종·명부 재대조). */}
      <div className="mx-auto max-w-container px-4 pb-5 text-center sm:text-left">
        <p className="text-caption text-muted-foreground">
          매일 00:00 KST 자동 수집 · Greenhouse·Lever·Ashby 등 12개 채용 소스 · 정부 스폰서 명부 매일 교차검증
        </p>
      </div>
    </section>
  );
}
