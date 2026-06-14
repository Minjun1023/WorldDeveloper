// 회사 사실(Wikidata) 표시용 포맷 헬퍼. 컴포넌트와 분리해 단위 테스트한다.

// Wikidata 영문 업종 라벨 → 한국어. 없으면 영문 그대로(정직: 임의 번역보다 원문).
const INDUSTRY_KO: Record<string, string> = {
  "software industry": "소프트웨어",
  "business software industry": "비즈니스 소프트웨어",
  "financial services": "금융 서비스",
  "mobile payment industry": "모바일 결제",
  "artificial intelligence": "인공지능(AI)",
  "tourism industry": "여행·관광",
  "food delivery service": "음식 배달",
  "semiconductor industry": "반도체",
  "data analytics software industry": "데이터 분석",
  "it performance management": "IT 모니터링",
  "e-commerce": "이커머스",
  "cloud computing": "클라우드 컴퓨팅",
  "computer security": "사이버 보안",
  "video game industry": "게임",
  "telecommunications": "통신",
  "advertising": "광고",
  "health care": "헬스케어",
  "transport": "운송",
  "retail": "리테일",
};

export function industryLabel(industry: string): string {
  return INDUSTRY_KO[industry.toLowerCase()] ?? industry;
}

/** 직원 수를 정직한 어림수로. 1000명 이상은 천 단위로 '내림'하고 '+'(이상)를 붙인다. */
export function employeesLabel(count: number, year?: string | null): string {
  const n =
    count >= 1000 ? `${Math.floor(count / 1000).toLocaleString()},000명+` : `${count.toLocaleString()}명`;
  return year ? `약 ${n} (${year}년 기준)` : `약 ${n}`;
}

/** 본사 표시: 도시 + (중복 아닐 때) 국가. 둘 다 없으면 프로필 위치로 폴백. */
export function headquartersLabel(
  hq?: string | null,
  country?: string | null,
  fallback?: string | null,
): string | null {
  if (!hq) return fallback ?? null;
  if (country && !hq.includes(country)) return `${hq}, ${country}`;
  return hq;
}
