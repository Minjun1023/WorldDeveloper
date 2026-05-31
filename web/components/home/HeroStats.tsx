export interface HomeStats {
  sponsors: number;
  total: number;
  companies: number;
  countries: number;
}

export function HeroStats({ stats }: { stats: HomeStats }) {
  const items = [
    { value: stats.sponsors, label: "비자 스폰서 공고", accent: true },
    { value: stats.total, label: "전체 공고", accent: false },
    { value: stats.companies, label: "회사", accent: false },
    { value: stats.countries, label: "국가", accent: false },
  ].filter((i) => i.value > 0);

  if (items.length === 0) return null;

  return (
    <div className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-3">
      {items.map((i) => (
        <div key={i.label} className="text-center">
          <div
            className={`text-h3 font-bold ${
              i.accent ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
            }`}
          >
            {i.value.toLocaleString()}
          </div>
          <div className="text-caption text-muted-foreground">{i.label}</div>
        </div>
      ))}
    </div>
  );
}
