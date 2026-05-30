// 회사 로고 유틸 (웹 전용). slug → 도메인 추론 + favicon URL + 이니셜/색 폴백.

// slug(ATS 토큰)가 실제 도메인 루트와 다른 경우만 보정. 대부분 {slug}.com 이 맞다.
const DOMAIN_OVERRIDES: Record<string, string> = {
  scaleai: "scale.com",
};

export function slugToDomain(slug: string | undefined | null): string {
  if (!slug) return "";
  const key = slug.trim().toLowerCase();
  if (!key) return "";
  return DOMAIN_OVERRIDES[key] ?? `${key}.com`;
}

// Logo.dev publishable 토큰(pk_...). Stripe 공개키처럼 클라이언트 노출용이라 NEXT_PUBLIC_ 사용.
// NEXT_PUBLIC_ 변수는 빌드 시 인라인되므로 토큰 추가 후 dev 재시작/재빌드 필요.
const LOGODEV_TOKEN = process.env.NEXT_PUBLIC_LOGODEV_TOKEN;

// 로고 소스 교체 단일 지점.
// 토큰 있으면 Logo.dev(실제 브랜드 로고 DB, 커버리지·품질↑), 없으면 무료 DuckDuckGo favicon 폴백.
export function logoUrl(domain: string): string {
  if (!domain) return "";
  if (LOGODEV_TOKEN) {
    return `https://img.logo.dev/${domain}?token=${LOGODEV_TOKEN}&size=128&format=png&retina=true`;
  }
  return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
}

const PALETTE = [
  "#0ea5e9", "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f59e0b", "#10b981", "#14b8a6", "#3b82f6", "#a855f7",
];

// 이름 해시 → 고정 팔레트 색(회사마다 일관된 배경색).
export function colorFromName(name: string): string {
  const s = name || "?";
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return PALETTE[h % PALETTE.length];
}

// display_name 첫 1~2 단어 이니셜(최대 2자, 대문자).
export function initials(name: string): string {
  const words = (name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
