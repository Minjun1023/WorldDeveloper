// 히어로 상단 라이브 신호 배지. Readdy 목업의 초록 점 + "비자 스폰서 공고 N건".
// 갱신 주기("업데이트됨" 등) 문구는 ETL 스케줄러가 상시 가동이 아니라 넣지 않는다(정직).
export function CredibilityPill({ sponsorCount }: { sponsorCount?: number }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-caption font-semibold text-success"
      style={{ backgroundColor: "color-mix(in srgb, var(--success) 12%, transparent)" }}
    >
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
          style={{ backgroundColor: "var(--success)" }}
        />
        <span
          className="relative inline-flex h-2 w-2 rounded-full"
          style={{ backgroundColor: "var(--success)" }}
        />
      </span>
      비자 스폰서 공고{sponsorCount ? ` ${sponsorCount.toLocaleString()}건` : ""}
    </span>
  );
}
