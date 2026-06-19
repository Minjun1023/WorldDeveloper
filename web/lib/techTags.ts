// 공고 태그에서 "기술 스택 칩"으로 보여줄 항목만 남긴다.
// 백엔드 태그는 ETL TECH_KEYWORDS 에서 추출돼 개념/방법론(observability·devops 등)이나
// 공고 회사명과 같은 제품명(예: Datadog 공고의 "datadog")이 섞여 들어온다. 이건 "기술 스택"이
// 아니므로 표시 단계에서 제거한다. (구체 기술 — 언어/프레임워크/DB/클라우드/linux·git 등은 유지)

// 개념·방법론·도메인 — 구체적인 명명 기술이 아니라 실천/영역이라 스택 칩에서 제외.
const NON_TECH_CONCEPTS = new Set<string>([
  "observability",
  "devops",
  "sre",
  "mlops",
  "agile",
  "scrum",
  "microservices",
  "serverless",
  "gitops",
  "ci/cd",
  "event-driven",
  "message queue",
  "distributed systems",
  "data engineering",
  "data pipeline",
  "data warehouse",
  "data lake",
  "machine learning",
  "deep learning",
  "reinforcement learning",
  "computer vision",
  "natural language processing",
  "rest api",
]);

const norm = (s: string) => s.trim().toLowerCase();

export function filterTechTags(
  tags: string[] | undefined | null,
  company?: { slug?: string; display_name?: string },
): string[] {
  if (!tags) return [];
  // 공고 회사명/슬러그와 같은 태그(예: Datadog 공고의 "datadog")는 중복이라 제외.
  const companyNames = new Set<string>();
  if (company?.slug) companyNames.add(norm(company.slug));
  if (company?.display_name) companyNames.add(norm(company.display_name));

  return tags.filter((t) => {
    const n = norm(t);
    if (!n) return false;
    if (NON_TECH_CONCEPTS.has(n)) return false;
    if (companyNames.has(n)) return false;
    return true;
  });
}
