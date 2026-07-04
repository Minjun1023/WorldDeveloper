import Link from "next/link";

import { GUIDE_DISCLAIMER, VISA_GUIDES } from "@/lib/visa-guide";

export const metadata = {
  title: "비자 가이드 — 국가별 스폰서십 개요",
  description: "한국 개발자의 해외 취업 — 국가별 비자 스폰서십 개요와 공식 출처.",
};

export default function VisaGuideIndexPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-2">
        <p className="text-body-sm font-semibold text-primary">비자 가이드</p>
        <h1 className="text-display">국가별 비자 스폰서십, 핵심만</h1>
        <p className="text-muted-foreground">
          &ldquo;비자 스폰서&rdquo;가 나라마다 어떤 의미인지, 어디서 공식 정보를 확인하는지 간단히 정리했어요.
        </p>
      </header>

      <p className="rounded-xl border border-warning/30 bg-warning/5 p-4 text-body-sm text-muted-foreground">
        {GUIDE_DISCLAIMER}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {VISA_GUIDES.map((g) => (
          <Link
            key={g.slug}
            href={`/visa/${g.slug}`}
            className="group rounded-2xl border border-border bg-surface p-6 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl leading-none" aria-hidden="true">{g.flag}</span>
              <span className="text-h3 font-bold group-hover:text-primary">{g.country}</span>
            </div>
            <p className="mt-2 text-body-sm font-semibold text-foreground">{g.visaName}</p>
            <p className="mt-1 line-clamp-2 text-body-sm text-muted-foreground">{g.summary}</p>
            <span className="mt-3 inline-block text-body-sm font-semibold text-primary">
              자세히 보기 →
            </span>
          </Link>
        ))}
      </div>

      <p className="text-body-sm text-muted-foreground">
        찾는 나라가 없나요? 우리는 스폰서십이 확인된 공고를 우선 다루며, 국가는 계속 늘려가고 있어요.{" "}
        <Link href="/search?visa=sponsors" className="font-semibold text-primary hover:underline">
          비자 스폰서 공고 보기 →
        </Link>
      </p>
    </div>
  );
}
