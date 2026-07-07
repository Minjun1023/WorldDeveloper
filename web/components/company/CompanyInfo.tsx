import { COMPANY_FACTS } from "@/lib/company-facts";
import {
  employeesLabel,
  headquartersLabel,
  industryLabel,
} from "@/lib/company-facts-format";
import { companyBlurb } from "@/lib/company-blurb";
import { companyProfile } from "@/lib/company-profiles";
import { COMPANY_SUMMARIES } from "@/lib/company-summaries";
import { COMPANY_SIZE, SIZE_LABEL } from "@/lib/company-size";
import { USD_TO_KRW } from "@/lib/salary";
import type { CompanyH1bWage } from "@/lib/types";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-body-sm">
      <dt className="w-20 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-foreground">{children}</dd>
    </div>
  );
}

/**
 * 회사 정보 패널 — 한 줄 소개(수기 큐레이션) + 위키백과 요약(CC BY-SA, 출처 링크 필수)
 * + 정직하게 보강한 사실(Wikidata). 표시할 데이터가 하나도 없으면 렌더하지 않는다.
 */
export function CompanyInfo({
  slug,
  tags,
  location,
  h1bWage,
}: {
  slug: string;
  tags?: string[];
  location?: string;
  h1bWage?: CompanyH1bWage | null;
}) {
  const profile = companyProfile(slug);
  const facts = COMPANY_FACTS[slug];
  const wiki = COMPANY_SUMMARIES[slug];

  const hqText = headquartersLabel(facts?.hq, facts?.country, profile?.location);

  // 직원 규모: 정확 숫자(Wikidata) 우선, 없으면 밴드(company-size) 폴백 → 316곳 전부 표시.
  const sizeBand = COMPANY_SIZE[slug];
  const sizeText = facts?.employees
    ? employeesLabel(facts.employees, facts.employeesYear)
    : sizeBand
      ? SIZE_LABEL[sizeBand]
      : null;

  const hasFacts = Boolean(
    facts && (facts.employees || facts.industry || facts.founded || facts.hq),
  );

  // 수기 설명·위키 요약·facts 모두 없을 때만 태그/위치 기반 폴백 한 줄(중복 방지).
  const fallbackBlurb =
    !profile?.description && !wiki && !hasFacts
      ? companyBlurb(slug, { tags, location: profile?.location ?? location })
      : null;

  // H-1B 신고 연봉(중앙값) — "$264,514 (약 3.7억 원)" 형태. 데이터 없으면 행 생략.
  const h1bText = h1bWage
    ? `$${h1bWage.median_wage.toLocaleString()} (약 ${((h1bWage.median_wage * USD_TO_KRW) / 1e8).toFixed(1)}억 원)`
    : null;

  if (!profile?.description && !wiki && !hasFacts && !hqText && !fallbackBlurb && !sizeText && !h1bText) {
    return null;
  }

  const description = profile?.description ?? fallbackBlurb;

  return (
    <section className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="text-h3">회사 정보</h2>

      {description && (
        <p className="mt-3 text-body-sm leading-relaxed text-foreground/90">
          {description}
        </p>
      )}

      {wiki && (
        <p className="mt-3 text-body-sm leading-relaxed text-foreground/80">
          {wiki.extract}
        </p>
      )}

      <dl className="mt-4 grid gap-2 sm:grid-cols-2">
        {facts?.industry && <Row label="업종">{industryLabel(facts.industry)}</Row>}
        {sizeText && <Row label="기업 규모">{sizeText}</Row>}
        {facts?.founded && <Row label="설립">{facts.founded}년</Row>}
        {hqText && <Row label="본사">{hqText}</Row>}
        {h1bText && h1bWage && (
          <Row label="H-1B 연봉">
            <span className="font-semibold text-primary">{h1bText}</span>
            <span className="ml-1.5 text-caption text-muted-foreground">
              중앙값 · 미 노동부 공시 {h1bWage.cases}건
            </span>
            {/* H-1B 를 모르는 사용자를 위한 한 줄 설명. */}
            <p className="mt-0.5 text-caption leading-relaxed text-muted-foreground">
              H-1B는 미국 전문직 취업비자로, 이 금액은 회사가 외국인 직원을
              채용하며 미 노동부에 실제 신고한 연봉입니다.
            </p>
          </Row>
        )}
        {facts?.website && (
          <Row label="웹사이트">
            <a
              href={facts.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {facts.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
            </a>
          </Row>
        )}
      </dl>
    </section>
  );
}
