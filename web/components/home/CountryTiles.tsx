import Link from "next/link";

const COUNTRIES: { name: string; cities: string; region: string }[] = [
  { name: "독일", cities: "Berlin · Munich", region: "germany" },
  { name: "네덜란드", cities: "Amsterdam", region: "netherlands" },
  { name: "영국", cities: "London", region: "uk" },
  { name: "아일랜드", cities: "Dublin", region: "ireland" },
];

export function CountryTiles() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {COUNTRIES.map((c) => (
        <Link
          key={c.region}
          href={`/search?region=${c.region}`}
          className="rounded-lg border border-border bg-surface-2 p-4 transition-colors hover:border-primary/40"
        >
          <div className="font-semibold">{c.name}</div>
          <div className="mt-1 text-caption text-muted-foreground">{c.cities}</div>
        </Link>
      ))}
    </div>
  );
}
