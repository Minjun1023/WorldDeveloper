import Link from "next/link";

const COUNTRIES: { name: string; cities: string; location: string }[] = [
  { name: "독일", cities: "Berlin · Munich", location: "Germany" },
  { name: "네덜란드", cities: "Amsterdam", location: "Netherlands" },
  { name: "영국", cities: "London", location: "United Kingdom" },
  { name: "아일랜드", cities: "Dublin", location: "Ireland" },
];

export function CountryTiles() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {COUNTRIES.map((c) => (
        <Link
          key={c.location}
          href={`/search?location=${encodeURIComponent(c.location)}`}
          className="rounded-lg border border-border bg-surface-2 p-4 transition-colors hover:border-primary/40"
        >
          <div className="font-semibold">{c.name}</div>
          <div className="mt-1 text-caption text-muted-foreground">{c.cities}</div>
        </Link>
      ))}
    </div>
  );
}
