// 기업 태그 표시 유틸 — companies.json 태그(영문 소문자 원문)를 한국어 UI 라벨로.
// 라벨 미등록 태그는 원문 그대로 노출(롱테일 100+ 개를 다 번역하지 않는다).

// 지역·메타 성격 태그 — "분야" 필터의 분류 체계를 오염시키므로 옵션에서 제외.
export const NON_DISCIPLINE_TAGS = new Set([
  "europe",
  "asia",
  "japan",
  "remote",
  "remote-first",
  "startups",
  "tech",
  "microsoft",
]);

const TAG_LABEL: Record<string, string> = {
  fintech: "핀테크",
  ai: "AI",
  devtools: "개발자 도구",
  saas: "SaaS",
  data: "데이터",
  marketplace: "마켓플레이스",
  infra: "인프라",
  infrastructure: "인프라",
  security: "보안",
  consumer: "컨슈머",
  gaming: "게임",
  productivity: "생산성",
  ecommerce: "이커머스",
  crypto: "크립토",
  payments: "결제",
  database: "데이터베이스",
  ml: "머신러닝",
  "hr-tech": "HR 테크",
  hr: "HR",
  healthtech: "헬스케어",
  "health-tech": "헬스케어",
  mobility: "모빌리티",
  analytics: "애널리틱스",
  observability: "옵저버빌리티",
  media: "미디어",
  delivery: "배달",
  insurance: "보험",
  edtech: "에듀테크",
  social: "소셜",
  "open-source": "오픈소스",
  cloud: "클라우드",
  travel: "여행",
  search: "검색",
  streaming: "스트리밍",
  robotics: "로보틱스",
  hardware: "하드웨어",
  enterprise: "엔터프라이즈",
  automation: "자동화",
  research: "리서치",
};

export function tagLabel(tag: string): string {
  return TAG_LABEL[tag] ?? tag;
}
