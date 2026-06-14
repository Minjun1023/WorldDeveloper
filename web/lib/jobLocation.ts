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
