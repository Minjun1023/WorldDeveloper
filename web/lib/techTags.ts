// 공고 태그에서 "기술 스택 칩"으로 보여줄 항목만 남긴다.
// 백엔드 태그는 ETL TECH_KEYWORDS 에서 추출돼 개념/방법론(observability·devops 등)이나
// 공고 회사명과 같은 제품명(예: Datadog 공고의 "datadog")이 섞여 들어온다. 이건 "기술 스택"이
// 아니므로 표시 단계에서 제거한다. (구체 기술 — 언어/프레임워크/DB/클라우드/linux·git 등은 유지)

// 운영 실천·방법론·아키텍처 스타일 — '쓰는 기술'이 아니라 '일하는/만드는 방식'이라 스택 칩에서 제외.
// 주의: machine learning·deep learning·computer vision 같은 전문 분야나 data engineering 등
// 도메인은 직무를 알려주는 의미 있는 태그라 제외하지 않는다(과거 너무 공격적이라 ML 공고의
// 스택이 통째로 비던 문제 수정).
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
