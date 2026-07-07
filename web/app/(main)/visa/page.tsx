import Link from "next/link";

import { fetchRegions } from "@/lib/api";
import { GUIDE_DISCLAIMER, VISA_GUIDES } from "@/lib/visa-guide";

export const metadata = {
  title: "비자 가이드 — 국가별 스폰서십 개요",
  description: "한국 개발자의 해외 취업 — 국가별 비자 스폰서십 개요와 공식 출처.",
};

// 컴팩트 그리드 — 국기·국가·대표 비자·공고 수만. 요약문·설명 헤더는 제거(상세 페이지 담당),
// 공고 수 연동으로 "가이드 = 공고로 가는 관문" 역할을 분명히 한다. 면책은 하단 축소.
export default async function VisaGuideIndexPage() {
  const regions = await fetchRegions();
  const countByCode = new Map(regions.map((r) => [r.value, r.count]));

  // 공고 수 내림차순 — 기회가 많은 나라부터.
  const guides = [...VISA_GUIDES].sort(
    (a, b) => (countByCode.get(b.regionCode) ?? 0) - (countByCode.get(a.regionCode) ?? 0),
  );

  return (
    <div className="space-y-6">
      <h1 className="sr-only">비자 가이드</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {guides.map((g) => {
          const count = countByCode.get(g.regionCode) ?? 0;
          return (
            <Link
              key={g.slug}
              href={`/visa/${g.slug}`}
              className="group flex flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl leading-none" aria-hidden="true">{g.flag}</span>
                <span className="text-body font-bold group-hover:text-primary">{g.country}</span>
              </div>
              <p className="mt-2 line-clamp-1 text-body-sm text-muted-foreground" title={g.visaName}>
                {g.visaName}
              </p>
              <div className="mt-4 flex-1" aria-hidden="true" />
              {count > 0 ? (
                <p className="text-body-sm font-semibold text-primary">
                  {count.toLocaleString()}개 공고
                </p>
              ) : (
                <p className="text-body-sm text-muted-foreground">공고 준비 중</p>
              )}
            </Link>
          );
        })}
      </div>

      <p className="text-body-sm text-muted-foreground">
        찾는 나라가 없나요? 우리는 스폰서십이 확인된 공고를 우선 다루며, 국가는 계속 늘려가고 있어요.{" "}
        <Link href="/search?visa=sponsors" className="font-semibold text-primary hover:underline">
          비자 스폰서 공고 보기
        </Link>
      </p>

      {/* 면책 — 상단 박스 대신 하단 각주로 축소 */}
      <p className="border-t border-border pt-4 text-caption text-muted-foreground">{GUIDE_DISCLAIMER}</p>
    </div>
  );
}
