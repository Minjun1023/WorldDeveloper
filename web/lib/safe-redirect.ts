// 오픈 리다이렉트 방지 — callbackUrl 등 사용자 제어 리다이렉트 대상을 같은 오리진 내부
// 경로로만 제한한다. 외부 절대 URL("https://evil.com")·프로토콜 상대("//evil.com")·
// 백슬래시 우회("/\\evil.com")·제어문자가 섞이면 fallback("/") 으로 떨어뜨린다.
export function safeInternalPath(
  url: string | null | undefined,
  fallback = "/",
): string {
  if (!url) return fallback;
  if (!url.startsWith("/")) return fallback; // 절대/스킴 URL 거부
  if (url.startsWith("//") || url.startsWith("/\\")) return fallback; // 프로토콜 상대/우회 거부
  // 제어문자(코드포인트 < 0x20) 거부 — 헤더/네비게이션 우회 방지
  for (let i = 0; i < url.length; i++) {
    if (url.charCodeAt(i) < 0x20) return fallback;
  }
  return url;
}
