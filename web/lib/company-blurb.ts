import { COMPANY_FACTS } from "@/lib/company-facts";
import { industryKo } from "@/lib/company-facts-format";
import { companyProfile } from "@/lib/company-profiles";

/**
 * 회사 한 줄 소개. 우선순위:
 *   1) 수기 설명  2) 매핑된 한국어 업종  3) 태그/위치 폴백  4) null
 * opts.tags/opts.location 은 C 폴백 전용 — 호출처가 중복 노출을 피하려면 생략한다.
 */
export function companyBlurb(
  slug: string,
  opts?: { tags?: string[]; location?: string },
): string | null {
  const profile = companyProfile(slug);
  if (profile?.description) return profile.description;

  const facts = COMPANY_FACTS[slug];
  const industry = facts?.industry ? industryKo(facts.industry) : undefined;
  if (industry) return industry;

  const tags = (opts?.tags ?? []).slice(0, 2);
  const parts = [...tags, opts?.location].filter(Boolean) as string[];
  return parts.length > 0 ? parts.join(" · ") : null;
}
