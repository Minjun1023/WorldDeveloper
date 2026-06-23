import Link from "next/link";

// 인기 검색어 칩 — 실측(search_queries 집계)이 충분하면 "인기", 콜드스타트(데이터 부족)면
// 큐레이션 기본값을 "추천"으로 정직하게 라벨링. 칩 클릭 시 해당 검색 실행(→ /search?q=).
const CURATED = ["React", "백엔드", "Go", "시니어", "Python", "데이터"];
const MIN_REAL = 3; // 실측으로 인정할 최소 검색어 수
const TARGET = 6; // 노출 칩 개수

export function PopularSearches({ terms }: { terms: string[] }) {
  const real = terms.map((t) => t.trim()).filter(Boolean);
  const measured = real.length >= MIN_REAL;

  const list = real.slice(0, TARGET);
  if (!measured) {
    const seen = new Set(list.map((t) => t.toLowerCase()));
    for (const c of CURATED) {
      if (list.length >= TARGET) break;
      if (!seen.has(c.toLowerCase())) {
        list.push(c);
        seen.add(c.toLowerCase());
      }
    }
  }
  if (list.length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className="text-caption font-semibold text-muted-foreground">
        {measured ? "인기" : "추천"}
      </span>
      {list.map((t) => (
        <Link
          key={t}
          href={`/search?q=${encodeURIComponent(t)}`}
          className="rounded-full border border-border px-3 py-1.5 text-body-sm text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t}
        </Link>
      ))}
    </div>
  );
}
