// 기업 태그 표시 유틸 — companies.json 태그(영문 소문자 원문)를 UI 라벨로.
// 라벨은 영문 원어(업계 통용어)를 쓰고, 한국어 설명을 병기한다(분야 드롭다운 보조 텍스트·칩 툴팁).
// 큐레이션(registry) 태그는 전수 등록. 미등록 태그(registry 밖 회사에 공고 기술 태그를 파생시킨
// 폴백 — python/pytorch 등)는 분야가 아니므로 분야 드롭다운에서 제외하고 칩에만 원문 노출.

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
  adtech: { label: "Adtech", desc: "광고 기술" },
  agents: { label: "AI Agents", desc: "AI 에이전트" },
  api: { label: "API", desc: "API 플랫폼" },
  audio: { label: "Audio", desc: "오디오 기술" },
  automotive: { label: "Automotive", desc: "자동차" },
  biotech: { label: "Biotech", desc: "바이오 기술" },
  brokerage: { label: "Brokerage", desc: "증권·중개" },
  ci: { label: "CI/CD", desc: "빌드·배포 자동화" },
  cms: { label: "CMS", desc: "콘텐츠 관리 시스템" },
  communication: { label: "Communication", desc: "커뮤니케이션" },
  communications: { label: "Communication", desc: "커뮤니케이션" },
  compliance: { label: "Compliance", desc: "규제 준수" },
  construction: { label: "Construction", desc: "건설 기술" },
  consulting: { label: "Consulting", desc: "컨설팅" },
  creative: { label: "Creative", desc: "크리에이티브 도구" },
  creator: { label: "Creator", desc: "크리에이터 이코노미" },
  crm: { label: "CRM", desc: "고객 관계 관리" },
  cx: { label: "CX", desc: "고객 경험" },
  defense: { label: "Defense", desc: "방위 산업" },
  design: { label: "Design", desc: "디자인 도구" },
  "dev-consulting": { label: "Dev Consulting", desc: "개발 컨설팅" },
  dx: { label: "DX", desc: "디지털 전환" },
  "enterprise-search": { label: "Enterprise Search", desc: "기업용 검색" },
  fashion: { label: "Fashion", desc: "패션" },
  "food-tech": { label: "Food Tech", desc: "푸드 테크" },
  "gig-work": { label: "Gig Work", desc: "긱 이코노미" },
  hiring: { label: "Hiring", desc: "채용 플랫폼" },
  insurtech: { label: "Insurtech", desc: "보험 기술" },
  iot: { label: "IoT", desc: "사물인터넷" },
  legal: { label: "Legal", desc: "리걸 테크" },
  logistics: { label: "Logistics", desc: "물류" },
  manufacturing: { label: "Manufacturing", desc: "제조" },
  marketing: { label: "Marketing", desc: "마케팅 기술" },
  markets: { label: "Markets", desc: "금융 시장" },
  metaverse: { label: "Metaverse", desc: "메타버스" },
  monitoring: { label: "Monitoring", desc: "시스템 모니터링" },
  music: { label: "Music", desc: "음악" },
  nlp: { label: "NLP", desc: "자연어 처리" },
  nocode: { label: "No-code", desc: "노코드 도구" },
  platform: { label: "Platform", desc: "플랫폼" },
  "process-mining": { label: "Process Mining", desc: "업무 프로세스 분석" },
  proptech: { label: "Proptech", desc: "부동산 기술" },
  regtech: { label: "Regtech", desc: "규제 기술" },
  restaurant: { label: "Restaurant", desc: "외식·레스토랑" },
  sales: { label: "Sales", desc: "영업 도구" },
  speech: { label: "Speech", desc: "음성 인식·합성" },
  storage: { label: "Storage", desc: "스토리지" },
  support: { label: "Support", desc: "고객 지원" },
  translation: { label: "Translation", desc: "번역" },
  video: { label: "Video", desc: "비디오" },
  web: { label: "Web", desc: "웹" },
};

export function tagLabel(tag: string): string {
  return TAGS[tag]?.label ?? tag;
}

/** 한국어 보조 설명(미등록 태그는 undefined) — 드롭다운 보조 텍스트·칩 title 용. */
export function tagDesc(tag: string): string | undefined {
  return TAGS[tag]?.desc;
}

/** 등록된 분야 태그인가 — 분야 드롭다운은 등록 태그만 노출(파생 스택 태그 제외). */
export function isKnownTag(tag: string): boolean {
  return tag in TAGS;
}
