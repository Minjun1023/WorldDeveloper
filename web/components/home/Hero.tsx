import { HeroSearch } from "@/components/home/HeroSearch";
import type { RegionCount } from "@/lib/api";

export function Hero({ regions }: { regions: RegionCount[] }) {
  return (
    <section className="hero-gradient -mx-4 px-4 py-14 text-center sm:-mx-6 sm:px-6">
      <h1 className="text-display">
        EU <span className="text-primary">비자 스폰서</span> 공고, 한 곳에서.
      </h1>
      <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
        한국 개발자의 유럽 진출 — 비자 스폰서십 명시 공고 + 6차원 맞춤 추천.
      </p>
      <div className="mt-6">
        <HeroSearch regions={regions} />
      </div>
    </section>
  );
}
