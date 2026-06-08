import { computeCompanyStats } from "@/lib/companyStats";
import type { Job } from "@/lib/types";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-caption text-muted-foreground">{label}</div>
      <div className="mt-1 text-h2 font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

// 회사 공고 목록에서 계산한 실데이터 지표 4종. 설립연도/직원수(데이터 없음) 대신 표시한다.
export function CompanyStats({ jobs, jobCount }: { jobs: Job[]; jobCount: number }) {
  const stats = computeCompanyStats(jobs);
  const ratio = stats.sponsorRatio === null ? "—" : `${stats.sponsorRatio}%`;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label="현재 공고" value={String(jobCount)} />
      <StatCard label="비자 스폰서 비율" value={ratio} />
      <StatCard label="명부 검증 공고" value={String(stats.verifiedCount)} />
      <StatCard label="원격 가능 공고" value={String(stats.remoteCount)} />
    </div>
  );
}
