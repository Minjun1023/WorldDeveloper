// 공고 위치 표시 헬퍼 — 위치 텍스트 + 원격 라벨을 합치되 중복을 제거한다.
// 버그: location 이 이미 "Remote"/"Remote - US" 인데 is_remote 로 또 "원격"/"Remote" 를 붙여
// "Remote · Remote" 처럼 중복 표기되던 것을 막는다.

// 위치 문자열에 이미 원격 표기가 있는지(한/영/카타카나).
export function hasRemoteInText(loc?: string | null): boolean {
  return !!loc && /remote|리모트|원격/i.test(loc);
}

/**
 * 표시용 위치 파츠. location_ko 우선, is_remote 라벨은 위치에 원격 표기가 없을 때만 추가.
 * remoteLabel 기본 "원격"(영문 카드는 "Remote").
 */
export function locationDisplayParts(
  job: { location?: string; location_ko?: string | null; is_remote?: boolean },
  remoteLabel = "원격",
): string[] {
  const loc = job.location_ko ?? job.location ?? null;
  const parts: string[] = [];
  if (loc) parts.push(loc);
  if (job.is_remote && !hasRemoteInText(loc)) parts.push(remoteLabel);
  return parts;
}

// 진출 대상 국가의 긴 영문명 → 짧은 한글명(좁은 칸에서 위치가 2줄로 깨지지 않도록).
const COUNTRY_KO: Record<string, string> = {
  "united states": "미국", "united states of america": "미국", usa: "미국", "u.s.": "미국", "u.s.a.": "미국",
  "united kingdom": "영국", uk: "영국", england: "영국",
  netherlands: "네덜란드", "the netherlands": "네덜란드",
  germany: "독일", japan: "일본", canada: "캐나다", singapore: "싱가포르", ireland: "아일랜드",
  france: "프랑스", spain: "스페인", switzerland: "스위스", sweden: "스웨덴", australia: "호주",
  "new zealand": "뉴질랜드", denmark: "덴마크", norway: "노르웨이", finland: "핀란드", poland: "폴란드",
  portugal: "포르투갈", belgium: "벨기에", austria: "오스트리아", italy: "이탈리아",
};

function koCountry(token: string): string {
  return COUNTRY_KO[token.trim().toLowerCase()] ?? token.trim();
}

/**
 * 팩트 카드용 짧은 위치 — "Remote - United States" 같은 긴 표기를 "원격 · 미국"으로 압축해
 * 좁은 칸에서 한 줄에 들어가게 한다. 매핑 실패 시 원본을 그대로 둔다.
 */
export function compactLocation(
  job: { location?: string; location_ko?: string | null; is_remote?: boolean },
): string {
  const raw = locationDisplayParts(job).join(" · ").trim();
  if (!raw) return "";

  // "Remote - X" / "Remote, X" / "Remote · X" → "원격 · X"
  const remotePrefix = /^(remote|리모트|원격)\s*[-–·,]\s*/i;
  let rest = raw;
  let prefix = "";
  if (remotePrefix.test(raw)) {
    prefix = "원격";
    rest = raw.replace(remotePrefix, "");
  }

  // 남은 토큰들(도시·국가)을 분해해 국가명만 한글로 압축.
  const tokens = rest.split(/\s*[·,]\s*/).filter(Boolean).map(koCountry);
  const body = tokens.join(" · ");

  return [prefix, body].filter(Boolean).join(" · ") || raw;
}
