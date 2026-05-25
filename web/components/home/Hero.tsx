import Link from "next/link";

import { HeroSearch } from "@/components/home/HeroSearch";

const CHIPS: { label: string; href: string }[] = [
  { label: "비자 스폰서", href: "/search?visa=sponsors" },
  { label: "원격 가능", href: "/search?remote=true" },
];

export function Hero() {
  return (
    <section className="hero-gradient -mx-4 px-4 py-14 text-center sm:-mx-6 sm:px-6">
      <h1 className="text-display">
        EU <span className="text-primary">비자 스폰서</span> 공고, 한 곳에서.
      </h1>
      <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
        한국 개발자의 유럽 진출 — 비자 스폰서십 명시 공고 + 6차원 맞춤 추천.
      </p>
      <div className="mt-6">
        <HeroSearch />
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {CHIPS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-full border border-border bg-surface px-3 py-1.5 text-caption text-muted-foreground hover:text-foreground"
          >
            {c.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
