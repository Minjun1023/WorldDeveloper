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
  canada: "ca", japan: "jp", taiwan: "tw",
  argentina: "ar", australia: "au", "new zealand": "nz", singapore: "sg",
  israel: "il", india: "in", "hong kong": "hk", "south korea": "kr",
  serbia: "rs",
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
  // 다중 위치("Dallas, TX; SF, CA; Vancouver, Canada")는 첫 위치(주 근무지) 우선 판정 후 전체 폴백.
  const primary = location.split(";")[0]?.trim() || location;
  return isoFromSingle(primary) || (primary !== location ? isoFromSingle(location) : "");
}

function isoFromSingle(location: string): string {
  const lower = location.toLowerCase();
  // 구분자에 ' - '(대시)도 포함 — "United States - Remote", "Remote - US" 처럼
  // 다단어 국가명이 대시로 붙어 한 조각이 되어 매칭 실패하던 문제를 해소.
  const parts = lower.split(/[,/()|]| - /).map((s) => s.trim()).filter(Boolean);
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
  // 미국 주(州) 풀네임("California", "Texas", "New York" 등) → 미국. 국가명이 없을 때만.
  const cleaned = lower.replace(/\./g, "");
  if (US_STATE_NAMES.some((s) => cleaned.includes(s))) return "us";
  return "";
}

export function flagFromLocation(location?: string | null): string {
  const iso = isoFromLocation(location);
  return iso ? isoToFlag(iso) : "";
}

// ISO2 → 한국어 국가명(원격 지역 제한 배지용 짧은 라벨). isoFromLocation 이 낼 수 있는 코드를 모두 포함.
const ISO_KO: Record<string, string> = {
  us: "미국", jp: "일본", ca: "캐나다", gb: "영국", de: "독일", fr: "프랑스",
  es: "스페인", nl: "네덜란드", pl: "폴란드", ie: "아일랜드", pt: "포르투갈",
  se: "스웨덴", dk: "덴마크", it: "이탈리아", at: "오스트리아", cz: "체코",
  ch: "스위스", no: "노르웨이", fi: "핀란드", be: "벨기에", lu: "룩셈부르크",
  tw: "대만", ar: "아르헨티나", au: "호주", nz: "뉴질랜드", sg: "싱가포르",
  il: "이스라엘", in: "인도", hk: "홍콩", kr: "한국", rs: "세르비아",
};

// 미국 주(州) 풀네임 — "Remote - California", "Washington D.C." 처럼 isoFromLocation 이 못 잡는
// 풀네임 주를 미국으로 인식하기 위함. georgia 는 국가 Georgia 와 겹쳐 의도적으로 제외(보수적).
const US_STATE_NAMES = [
  "alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut",
  "delaware", "florida", "hawaii", "idaho", "illinois", "indiana", "iowa", "kansas",
  "kentucky", "louisiana", "maine", "maryland", "massachusetts", "michigan", "minnesota",
  "mississippi", "missouri", "montana", "nebraska", "nevada", "ohio", "oklahoma", "oregon",
  "pennsylvania", "tennessee", "texas", "utah", "vermont", "virginia", "wisconsin", "wyoming",
  "new hampshire", "new jersey", "new mexico", "new york", "north carolina", "north dakota",
  "south carolina", "south dakota", "west virginia", "rhode island", "washington",
];

// region_restricted 원격 공고가 "어느 지역 한정"인지 짧은 한국어 라벨. 못 알아내면 ""(일반 라벨로 폴백).
// 국가 단위로 정규화한다 — 한국 거주자에게 핵심은 "어느 나라에 있어야 하나"이고, 도시 디테일은
// 카드의 지역 줄이 이미 보여준다. 정확히 한 국가로 좁혀질 때만 구체 라벨을 쓰고, 여러 국가가
// 섞이거나("United States & Canada", 5개국 나열 등) 모호하면 일반 "지역 제한"으로 폴백한다(정직).
// 여러 나라를 아우르는 광역 권역 토큰. 이게 있으면 단일 국가로 단정하지 않고 일반 라벨로 폴백한다
// ("UK/EU*" 를 '영국 한정'으로 좁히면 EU 를 빠뜨려 오해를 주므로).
const MACRO_REGIONS = new Set([
  "eu", "emea", "europe", "european", "apac", "latam", "amer", "americas", "america",
  "anywhere", "global", "worldwide", "international",
]);

export function remoteRegionLabelKo(location?: string | null): string {
  if (!location) return "";
  const lower = location.toLowerCase();
  const found = new Set<string>();
  // 명시적 국가명(다단어 포함) + 단어 토큰(us/usa/uk 등)을 모두 모은다.
  const parts = lower.split(/[,/()|;]| - /).map((s) => s.trim()).filter(Boolean);
  for (const p of parts) if (COUNTRY_NAME_ISO[p]) found.add(COUNTRY_NAME_ISO[p]);
  const tokens = lower.split(/[^a-z]+/).filter(Boolean);
  for (const t of tokens) if (COUNTRY_NAME_ISO[t]) found.add(COUNTRY_NAME_ISO[t]);
  // 광역 권역 토큰이 섞여 있으면(EU, Europe, APAC 등) 한 나라로 단정하지 않는다.
  if (tokens.some((t) => MACRO_REGIONS.has(t) && !COUNTRY_NAME_ISO[t])) return "";
  // 국가명이 전혀 없을 때만 미국 주(州) 풀네임으로 미국을 추론("Remote - California" 등).
  if (found.size === 0) {
    const cleaned = lower.replace(/\./g, "");
    if (US_STATE_NAMES.some((s) => cleaned.includes(s))) found.add("us");
  }
  return found.size === 1 ? (ISO_KO[[...found][0]] ?? "") : "";
}
