import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { fetchRegions } from "@/lib/api";
import { GUIDE_DISCLAIMER, VISA_GUIDES } from "@/lib/visa-guide";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "비자 가이드 — 국가별 스폰서십 개요",
  description: "한국 개발자의 해외 취업 — 국가별 비자 스폰서십 개요와 공식 출처.",
};

// 투카드형 — 공고 상위 4개국은 큰 카드(비자명·한 줄 특징·공고 수), 나머지는 컴팩트 칩 행.
// 슬림 한 줄 제목으로 페이지 정체성 유지, 면책은 하단 각주.
const FEATURED_COUNT = 4;

export default async function VisaGuideIndexPage() {
  const regions = await fetchRegions();
  const countByCode = new Map(regions.map((r) => [r.value, r.count]));

  // 공고 수 내림차순 — 기회가 많은 나라부터.
  const guides = [...VISA_GUIDES].sort(
    (a, b) => (countByCode.get(b.regionCode) ?? 0) - (countByCode.get(a.regionCode) ?? 0),
  );
  const featured = guides.slice(0, FEATURED_COUNT);
  const rest = guides.slice(FEATURED_COUNT);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-h2">비자 가이드</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">
          국가를 고르면 대표 비자·공식 출처·스폰서 공고로 연결돼요.
        </p>
      </header>

      {/* 주요 국가 — 공고 수 상위 4개국 큰 카드 */}
      <section>
        <h2 className="mb-3 text-body-sm font-semibold text-muted-foreground">주요 국가</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {featured.map((g) => {
            const count = countByCode.get(g.regionCode) ?? 0;
            return (
              <Link
                key={g.slug}
                href={`/visa/${g.slug}`}
                className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl leading-none" aria-hidden="true">{g.flag}</span>
                  <span className="text-body font-bold group-hover:text-primary">{g.country}</span>
                </div>
                <p className="mt-2 line-clamp-1 text-body-sm text-muted-foreground" title={g.visaName}>
                  {g.visaName}
                </p>
                <p className="mt-1 text-caption text-muted-foreground">{g.hook}</p>
                <p className="mt-3 text-body-sm font-semibold text-primary">
                  {count.toLocaleString()}개 공고
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 그 외 국가 — 컴팩트 칩 행 */}
      <section>
        <h2 className="mb-3 text-body-sm font-semibold text-muted-foreground">그 외 국가</h2>
        <div className="flex flex-wrap gap-2">
          {rest.map((g) => {
            const count = countByCode.get(g.regionCode) ?? 0;
            return (
              <Link
                key={g.slug}
                href={`/visa/${g.slug}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-body-sm transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span aria-hidden="true">{g.flag}</span>
                <span className="font-medium">{g.country}</span>
                {count > 0 && (
                  <span className="tabular-nums text-caption text-muted-foreground">
                    {count.toLocaleString()}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </section>

      {/* 전폭 한 줄 텍스트 대신 세로 스택 카드 — 제목/설명/버튼 순 */}
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-body font-bold text-foreground">찾는 나라가 없나요?</h2>
        <p className="mt-1 max-w-md text-body-sm text-muted-foreground">
          우리는 스폰서십이 확인된 공고를 우선 다루며, 국가는 계속 늘려가고 있어요.
        </p>
        <Link href="/search?visa=sponsors" className={cn(buttonVariants({ variant: "outline" }), "mt-4")}>
          비자 스폰서 공고 보기
        </Link>
      </section>

      {/* 면책 — 하단 각주 (전폭 한 줄 대신 문장 단위 세로 배치) */}
      <div className="space-y-1 border-t border-border pt-4">
        {GUIDE_DISCLAIMER.split(". ").map((s, i, arr) => (
          <p key={i} className="text-caption text-muted-foreground">
            {s}
            {i < arr.length - 1 ? "." : ""}
          </p>
        ))}
      </div>
    </div>
  );
}
