// 지역(region) value → ISO 3166-1 alpha-2 코드. /regions 의 value 기준.
const REGION_ISO: Record<string, string> = {
  us: "us",
  japan: "jp",
  canada: "ca",
  uk: "gb",
  germany: "de",
  france: "fr",
  spain: "es",
  netherlands: "nl",
  poland: "pl",
  ireland: "ie",
  portugal: "pt",
  sweden: "se",
  denmark: "dk",
  italy: "it",
  austria: "at",
  czech: "cz",
  switzerland: "ch",
  norway: "no",
  finland: "fi",
  belgium: "be",
  luxembourg: "lu",
};

// ISO 3166-1 alpha-2 → 국기 이모지(regional indicator symbols, 0x1F1E6 = 'A').
function isoToFlag(iso: string): string {
  return iso.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

// 지역 value 를 국기 이모지로. 매핑 없으면 빈 문자열(국기 미표시).
export function regionFlag(value: string): string {
  const iso = REGION_ISO[value];
  return iso ? isoToFlag(iso) : "";
}

// 자유 텍스트 location("Berlin, Germany" 등)의 국가명을 보수적으로만 국기로 매핑.
// 확실히 아는 국가명일 때만 표시(틀린 국기는 표시하지 않는다 — 정직).
// 풀네임 위주(US 타운명과 겹치는 국가명 Mexico/China/Brazil 등은 의도적으로 제외).
const COUNTRY_NAME_ISO: Record<string, string> = {
  germany: "de", deutschland: "de",
  netherlands: "nl", "the netherlands": "nl",
  sweden: "se", ireland: "ie", france: "fr", denmark: "dk", spain: "es",
  finland: "fi", austria: "at", portugal: "pt", poland: "pl", italy: "it",
  switzerland: "ch", norway: "no", belgium: "be", luxembourg: "lu",
  czechia: "cz", "czech republic": "cz",
  "united kingdom": "gb", uk: "gb", england: "gb", scotland: "gb",
  "united states": "us", usa: "us", us: "us", "united states of america": "us", "u.s.": "us",
  canada: "ca", japan: "jp",
  argentina: "ar", australia: "au", "new zealand": "nz", singapore: "sg",
  israel: "il", india: "in", "hong kong": "hk", "south korea": "kr",
};

// 미국 주 약자(2글자) + DC. 명시적 국가명이 하나도 없을 때만 폴백으로 미국 추론에 사용한다.
// (CA=캐나다, DE=독일, IN=인도 등 ISO 국가코드와 겹치므로 반드시 국가명 매칭 뒤에만 적용.)
const US_STATES = new Set([
  "al", "ak", "az", "ar", "ca", "co", "ct", "de", "dc", "fl", "ga", "hi", "id",
  "il", "in", "ia", "ks", "ky", "la", "me", "md", "ma", "mi", "mn", "ms", "mo",
  "mt", "ne", "nv", "nh", "nj", "nm", "ny", "nc", "nd", "oh", "ok", "or", "pa",
  "ri", "sc", "sd", "tn", "tx", "ut", "vt", "va", "wa", "wv", "wi", "wy",
]);

// 자유 텍스트 location 에서 ISO2 국가코드를 보수적으로 도출한다. 모르면 "".
//  1) 명시적 국가명(다단어 포함)을 먼저 — 가장 신뢰.
//  2) 국가명이 전혀 없을 때만 US/USA/UK 토큰·미국 주 약자로 미국을 추론
//     ("Livingston, NJ / New York, NY", "Salt Lake City, UT", "US Remote" 등).
export function isoFromLocation(location?: string | null): string {
  if (!location) return "";
  const lower = location.toLowerCase();
  const parts = lower.split(/[,/()|]/).map((s) => s.trim()).filter(Boolean);
  // 마지막 조각(보통 국가)을 먼저, 그다음 나머지 조각을 시도.
  const ordered = parts.length ? [parts[parts.length - 1], ...parts] : [];
  for (const p of ordered) {
    if (COUNTRY_NAME_ISO[p]) return COUNTRY_NAME_ISO[p];
  }
  // 단어 토큰: us/usa/uk 같은 단일 국가 신호 → 그다음 미국 주 약자.
  const tokens = lower.split(/[^a-z]+/).filter(Boolean);
  for (const t of tokens) {
    if (COUNTRY_NAME_ISO[t]) return COUNTRY_NAME_ISO[t];
  }
  for (const t of tokens) {
    if (US_STATES.has(t)) return "us";
  }
  return "";
}

export function flagFromLocation(location?: string | null): string {
  const iso = isoFromLocation(location);
  return iso ? isoToFlag(iso) : "";
}
