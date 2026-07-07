function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-caption text-muted-foreground">{label}</div>
      <div className="mt-1 text-h2 font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

// 실데이터 지표 4종. 통계는 백엔드가 전체(필터된) 공고로 집계해 내려준다(페이지 슬라이스와 무관).
export function CompanyStats({
  jobCount,
  sponsorRatio,
  verifiedCount,
  remoteCount,
}: {
  jobCount: number;
  sponsorRatio: number | null;
  verifiedCount: number;
  remoteCount: number;
}) {
  const ratio = sponsorRatio === null ? "—" : `${sponsorRatio}%`;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label="현재 공고" value={String(jobCount)} />
      <StatCard label="비자 스폰서 비율" value={ratio} />
      <StatCard label="명부 검증 공고" value={String(verifiedCount)} />
      <StatCard label="원격 가능 공고" value={String(remoteCount)} />
    </div>
  );
}
