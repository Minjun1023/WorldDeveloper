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

// 지역 value 를 국기 이모지로. 매핑 없으면 빈 문자열(국기 미표시).
export function regionFlag(value: string): string {
  const iso = REGION_ISO[value]?.toUpperCase();
  if (!iso) return "";
  // ISO2 → regional indicator symbols (0x1F1E6 = 'A')
  return iso.replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}
