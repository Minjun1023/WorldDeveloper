import { COMPANY_FACTS } from "@/lib/company-facts";
import {
  employeesLabel,
  headquartersLabel,
  industryLabel,
} from "@/lib/company-facts-format";
import { companyBlurb } from "@/lib/company-blurb";
import { companyProfile } from "@/lib/company-profiles";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-body-sm">
      <dt className="w-20 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-foreground">{children}</dd>
    </div>
  );
}

/**
 * 회사 정보 패널 — 한 줄 소개(수기 큐레이션) + 정직하게 보강한 사실(Wikidata).
 * 표시할 데이터가 하나도 없으면 렌더하지 않는다.
 */
export function CompanyInfo({
  slug,
  tags,
  location,
}: {
  slug: string;
  tags?: string[];
  location?: string;
}) {
  const profile = companyProfile(slug);
  const facts = COMPANY_FACTS[slug];

  const hqText = headquartersLabel(facts?.hq, facts?.country, profile?.location);

  const hasFacts = Boolean(
    facts && (facts.employees || facts.industry || facts.founded || facts.hq),
  );

  // 수기 설명·facts 둘 다 없을 때만 태그/위치 기반 폴백 한 줄(사실 행과 중복 방지).
  const fallbackBlurb =
    !profile?.description && !hasFacts
      ? companyBlurb(slug, { tags, location: profile?.location ?? location })
      : null;

  if (!profile?.description && !hasFacts && !hqText && !fallbackBlurb) return null;

  const description = profile?.description ?? fallbackBlurb;

  return (
    <section className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="text-h3">회사 정보</h2>

      {description && (
        <p className="mt-3 text-body-sm leading-relaxed text-foreground/90">
          {description}
        </p>
      )}

      <dl className="mt-4 grid gap-2 sm:grid-cols-2">
        {facts?.industry && <Row label="업종">{industryLabel(facts.industry)}</Row>}
        {facts?.employees ? (
          <Row label="직원 규모">{employeesLabel(facts.employees, facts.employeesYear)}</Row>
        ) : null}
        {facts?.founded && <Row label="설립">{facts.founded}년</Row>}
        {hqText && <Row label="본사">{hqText}</Row>}
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
