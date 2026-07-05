// 기업 태그 표시 유틸 — companies.json 태그(영문 소문자 원문)를 UI 라벨로.
// 라벨은 영문 원어(업계 통용어)를 쓰고, 뜻이 바로 안 와닿는 태그는 한국어 설명을 병기한다
// (분야 드롭다운의 보조 텍스트·칩 툴팁). 미등록 태그는 원문 그대로 노출(롱테일 100+ 개).

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

// 영문 표시 라벨 + 한국어 설명. desc 가 없는 태그는 라벨만 노출.
const TAGS: Record<string, { label: string; desc?: string }> = {
  fintech: { label: "Fintech", desc: "금융 기술·결제 서비스" },
  ai: { label: "AI", desc: "인공지능" },
  devtools: { label: "DevTools", desc: "개발자 도구" },
  saas: { label: "SaaS", desc: "구독형 소프트웨어" },
  data: { label: "Data", desc: "데이터 인프라·분석" },
  marketplace: { label: "Marketplace", desc: "중개 플랫폼" },
  infra: { label: "Infra", desc: "클라우드·서버 인프라" },
  infrastructure: { label: "Infra", desc: "클라우드·서버 인프라" },
  security: { label: "Security", desc: "보안" },
  consumer: { label: "Consumer", desc: "소비자 서비스" },
  gaming: { label: "Gaming", desc: "게임" },
  productivity: { label: "Productivity", desc: "생산성 도구" },
  ecommerce: { label: "E-commerce", desc: "전자상거래" },
  crypto: { label: "Crypto", desc: "암호화폐·블록체인" },
  payments: { label: "Payments", desc: "결제" },
  database: { label: "Database", desc: "데이터베이스" },
  ml: { label: "ML", desc: "머신러닝" },
  "hr-tech": { label: "HR Tech", desc: "인사·채용 기술" },
  hr: { label: "HR", desc: "인사·채용" },
  healthtech: { label: "Healthtech", desc: "헬스케어 기술" },
  "health-tech": { label: "Healthtech", desc: "헬스케어 기술" },
  mobility: { label: "Mobility", desc: "모빌리티·교통" },
  analytics: { label: "Analytics", desc: "데이터 분석" },
  observability: { label: "Observability", desc: "시스템 관측·모니터링" },
  media: { label: "Media", desc: "미디어" },
  delivery: { label: "Delivery", desc: "배달·물류" },
  insurance: { label: "Insurance", desc: "보험" },
  edtech: { label: "Edtech", desc: "교육 기술" },
  social: { label: "Social", desc: "소셜 서비스" },
  "open-source": { label: "Open Source", desc: "오픈소스" },
  cloud: { label: "Cloud", desc: "클라우드" },
  travel: { label: "Travel", desc: "여행" },
  search: { label: "Search", desc: "검색" },
  streaming: { label: "Streaming", desc: "스트리밍" },
  robotics: { label: "Robotics", desc: "로보틱스" },
  hardware: { label: "Hardware", desc: "하드웨어" },
  enterprise: { label: "Enterprise", desc: "기업용 솔루션" },
  automation: { label: "Automation", desc: "업무 자동화" },
  research: { label: "Research", desc: "연구·R&D" },
};

export function tagLabel(tag: string): string {
  return TAGS[tag]?.label ?? tag;
}

/** 한국어 보조 설명(미등록 태그는 undefined) — 드롭다운 보조 텍스트·칩 title 용. */
export function tagDesc(tag: string): string | undefined {
  return TAGS[tag]?.desc;
}
