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
const COUNTRY_NAME_ISO: Record<string, string> = {
  germany: "de", deutschland: "de",
  netherlands: "nl", "the netherlands": "nl",
  sweden: "se", ireland: "ie", france: "fr", denmark: "dk", spain: "es",
  finland: "fi", austria: "at", portugal: "pt", poland: "pl", italy: "it",
  switzerland: "ch", norway: "no", belgium: "be", luxembourg: "lu",
  czechia: "cz", "czech republic": "cz",
  "united kingdom": "gb", uk: "gb", england: "gb", scotland: "gb",
  "united states": "us", usa: "us", "united states of america": "us", "u.s.": "us",
  canada: "ca", japan: "jp",
};

export function flagFromLocation(location?: string | null): string {
  if (!location) return "";
  const parts = location.split(/[,/]/).map((s) => s.trim().toLowerCase());
  // 마지막 조각(보통 국가)을 먼저, 그다음 나머지 조각을 시도.
  const candidates = [parts[parts.length - 1], ...parts];
  for (const p of candidates) {
    const iso = COUNTRY_NAME_ISO[p];
    if (iso) return isoToFlag(iso);
  }
  return "";
}
