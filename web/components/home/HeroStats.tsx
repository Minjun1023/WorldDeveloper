import { CountUp } from "@/components/home/CountUp";

export interface HomeStats {
  sponsors: number;
  verified: number;
  companies: number;
  countries: number;
}

export function HeroStats({ stats, compact = false }: { stats: HomeStats; compact?: boolean }) {
  const items = [
    { value: stats.sponsors, label: "스폰서십 명시 공고" },
    { value: stats.verified, label: "정부 명부 검증 공고" },
    { value: stats.companies, label: "검증된 회사" },
    { value: stats.countries, label: "진출 국가" },
  ].filter((i) => i.value > 0);

  if (items.length === 0) return null;

  return (
    <div
      className={
        compact
          ? "grid grid-cols-2 gap-3"
          : "grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4"
      }
    >
      {items.map((i) => (
        <div
          key={i.label}
          className="rounded-xl border border-border bg-surface px-6 py-5 text-left"
        >
          <div className="text-[1.75rem] font-bold leading-none tabular-nums text-foreground">
            <CountUp value={i.value} />
          </div>
          <div className="mt-2 text-body-sm text-muted-foreground">{i.label}</div>
        </div>
      ))}
    </div>
  );
}
