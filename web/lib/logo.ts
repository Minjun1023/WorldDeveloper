// 회사 로고 유틸 (웹 전용). slug → 도메인 추론 + favicon URL + 이니셜/색 폴백.

// slug(ATS 토큰/슬러그화된 회사명)가 실제 도메인 루트와 다른 경우 보정. 대부분 {slug}.com 이 맞다.
const DOMAIN_OVERRIDES: Record<string, string> = {
  scaleai: "scale.com",
  crusoe: "crusoe.ai", // crusoe.com 은 동명의 다른 회사라 엉뚱한 로고가 뜬다
  // 잡보드 자유텍스트 회사(주로 독일 GmbH) — 공식 도메인 웹검색 확인 + Logo.dev 실제 로고(fallback=404=200) 검증.
  "neural-frames": "neuralframes.com",
  "quantum-systems-gmbh": "quantum-systems.com",
  "itestra-gmbh": "itestra.de",
  "k-tronik-gmbh": "ktronik.de",
  "evident-europe-gmbh": "evidenttechnology.com",
  "my-humancapital-gmbh": "my-humancapital.de",
  "logistikbude-gmbh": "logistikbude.com",
  "lexmind-gmbh": "lexmind.ai",
  "techbiz-global-gmbh": "techbiz.global",
  "batch-robotics-gmbh": "batch-robotics.com",
  "angeheuert-gmbh": "angeheuert.com",
  "myscribe-gmbh": "myscribe.de",
  "optitool-gmbh": "optitool.de",
  "spread-gmbh": "spread.ai",
  "actana-consulting-services-gmbh": "actana-consulting.eu",
  "cerpro-gmbh": "cerpro.io",
  "w-rth-cloud-services-gmbh": "wuerth-cs.com",
  "aphos-gesellschaft-f-r-it-sicherheit-mbh": "aphos.de",
  "msa-fleet-consulting-msa-software-solutions-ug": "msa-fleet-consulting.de",
  // irpd-gmbh: Logo.dev에 로고 없음(irpd.de 404) → 모노그램 유지.
};

// 슬러그화가 도메인 점을 하이픈으로 바꾸므로("lemon.io" → "lemon-io") 끝의 TLD를 복원.
// 명확한 도메인 TLD만(co/de 등 회사명 토큰과 혼동되는 것은 제외).
const TLD_SUFFIXES = new Set(["io", "ai", "ch", "dev", "app", "xyz", "gg", "sh", "so", "tech"]);

export function slugToDomain(slug: string | undefined | null): string {
  if (!slug) return "";
  const key = slug.trim().toLowerCase();
  if (!key) return "";
  const override = DOMAIN_OVERRIDES[key];
  if (override) return override;
  // "lemon-io" → "lemon.io", "comparis-ch" → "comparis.ch"
  const dash = key.lastIndexOf("-");
  if (dash > 0 && TLD_SUFFIXES.has(key.slice(dash + 1))) {
    return `${key.slice(0, dash)}.${key.slice(dash + 1)}`;
  }
  return `${key}.com`;
}

// Logo.dev publishable 토큰(pk_...). Stripe 공개키처럼 클라이언트 노출용이라 NEXT_PUBLIC_ 사용.
// NEXT_PUBLIC_ 변수는 빌드 시 인라인되므로 토큰 추가 후 dev 재시작/재빌드 필요.
const LOGODEV_TOKEN = process.env.NEXT_PUBLIC_LOGODEV_TOKEN;

// 로고 소스 교체 단일 지점.
// 토큰 있으면 Logo.dev(실제 브랜드 로고 DB, 커버리지·품질↑), 없으면 무료 DuckDuckGo favicon 폴백.
// size 는 화면 표시 픽셀(기본 64) — retina=true 가 2배로 서빙하므로 슬롯의 2배만 받는다.
// 기존 고정 size=128(+retina=256px) 은 36~40px 카드 로고엔 과대 → 표시 크기에 맞춰 대역폭 절감.
export function logoUrl(domain: string, size = 64): string {
  if (!domain) return "";
  if (LOGODEV_TOKEN) {
    return `https://img.logo.dev/${domain}?token=${LOGODEV_TOKEN}&size=${size}&format=png&retina=true`;
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
