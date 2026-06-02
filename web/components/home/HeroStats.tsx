import { CountUp } from "@/components/home/CountUp";

export interface HomeStats {
  sponsors: number;
  total: number;
  companies: number;
  countries: number;
}

export function HeroStats({ stats }: { stats: HomeStats }) {
  const items = [
    { value: stats.sponsors, label: "명부 검증 스폰서", verified: true },
    { value: stats.total, label: "라이브 공고", verified: false },
    { value: stats.companies, label: "회사", verified: false },
    { value: stats.countries, label: "국가", verified: false },
  ].filter((i) => i.value > 0);

  if (items.length === 0) return null;

  return (
    <div className="mx-auto mt-8 grid max-w-2xl grid-cols-2 gap-x-8 gap-y-4 sm:flex sm:flex-wrap sm:justify-center">
      {items.map((i) => (
        <div key={i.label} className="text-center">
          <div
            className={`text-h3 font-bold ${i.verified ? "text-verified" : "text-foreground"}`}
          >
            <CountUp value={i.value} />
          </div>
          <div className="text-caption text-muted-foreground">{i.label}</div>
        </div>
      ))}
    </div>
  );
}
