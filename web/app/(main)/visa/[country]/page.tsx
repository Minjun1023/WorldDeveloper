import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RelatedCommunity } from "@/components/community/RelatedCommunity";
import { GUIDE_DISCLAIMER, VISA_GUIDES, getVisaGuide } from "@/lib/visa-guide";

export function generateStaticParams() {
  return VISA_GUIDES.map((g) => ({ country: g.slug }));
}

export function generateMetadata({ params }: { params: { country: string } }) {
  const g = getVisaGuide(params.country);
  if (!g) return { title: "비자 가이드" };
  return {
    title: `${g.country} 비자 가이드 — ${g.visaName}`,
    description: g.summary,
  };
}

export default function VisaGuideCountryPage({ params }: { params: { country: string } }) {
  const g = getVisaGuide(params.country);
  if (!g) notFound();

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      {/* 뒤로가기 링크는 브레드크럼("홈 > 비자 가이드 > 국가")으로 대체 — 다른 상세 페이지와 일관. */}
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-3xl leading-none" aria-hidden="true">{g.flag}</span>
          <div>
            <h1 className="text-h1">{g.country} 비자 가이드</h1>
            <p className="mt-0.5 text-body-sm font-semibold text-primary">{g.visaName}</p>
          </div>
        </div>
        <p className="text-body text-foreground/90">{g.summary}</p>
      </header>

      <p className="rounded-xl border border-warning/30 bg-warning/5 p-4 text-body-sm text-muted-foreground">
        {GUIDE_DISCLAIMER}
      </p>

      <section className="space-y-3">
        <h2 className="text-h3">핵심 포인트</h2>
        <ul className="space-y-2">
          {g.points.map((p, i) => (
            <li key={i} className="flex gap-2 text-body text-foreground/90">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-h3">공식 출처</h2>
        <div className="space-y-2">
          {g.official.map((l) => (
            <a
              key={l.url}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="text-body-sm font-semibold text-foreground">{l.label}</span>
              <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </a>
          ))}
        </div>
      </section>

      {g.register && (
        <section className="space-y-2">
          <h2 className="text-h3">스폰서 명부 확인</h2>
          {g.registerNote && <p className="text-body-sm text-muted-foreground">{g.registerNote}</p>}
          <a
            href={g.register.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 rounded-xl border border-verified/30 bg-verified/5 p-4 transition-colors hover:border-verified/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="text-body-sm font-semibold text-foreground">{g.register.label}</span>
            <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </a>
        </section>
      )}

      <div className="border-t border-border pt-5">
        <Link
          href={`/search?region=${g.slug}&visa=sponsors`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-body-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
        >
          {g.country} 스폰서 공고 보기 →
        </Link>
      </div>

      {/* 라운지 역노출 — 이 나라 비자 경험 */}
      <RelatedCommunity
        filter={{ country: g.slug }}
        writeParams={{ country: g.slug, category: "visa" }}
        title={`${g.country} 비자 경험`}
        writeLabel="경험 공유하기"
      />
    </article>
  );
}
