// 공고 날짜 표기 유틸 (웹 전용, 순수 함수).

function parseDate(iso?: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

// 게시일 표기: 실제 게시 날짜(절대). 예 "2026. 5. 26. 게시".
export function postedLabel(posted_at?: string | null): string | null {
  const d = parseDate(posted_at);
  if (!d) return null;
  return `${d.toLocaleDateString("ko-KR")} 게시`;
}

// 게시일 상대 표기. 예 "3시간 전", "2일 전". 카드 푸터(시계 아이콘)용.
export function postedRelativeLabel(posted_at?: string | null): string | null {
  const d = parseDate(posted_at);
  if (!d) return null;
  const diff = Date.now() - d.getTime();
  if (diff < 3_600_000) return "방금 전";
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}주 전`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}개월 전`;
  return `${Math.floor(days / 365)}년 전`;
}

// 최근 본 공고 열람 시각 표기. postedRelativeLabel 재사용 + 자연스러운 어미.
// "X 전 봄"은 어색해서 친화적 어미로. 예 "방금 봤어요", "4시간 전에 봤어요", "2일 전에 봤어요".
export function viewedAgoLabel(ts: number): string {
  const rel = postedRelativeLabel(new Date(ts).toISOString());
  if (!rel) return "";
  return rel === "방금 전" ? "방금 봤어요" : `${rel}에 봤어요`;
}

export interface DeadlineLabel {
  text: string;
  urgent: boolean;
}

// 마감일 표기: closes_at 있으면 "마감 날짜 (D-N)", 없으면 "상시채용".
export function deadlineLabel(closes_at?: string | null): DeadlineLabel {
  const d = parseDate(closes_at);
  if (!d) return { text: "상시채용", urgent: false };
  const daysLeft = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  const date = d.toLocaleDateString("ko-KR");
  if (daysLeft < 0) return { text: `마감 ${date} (마감)`, urgent: false };
  return { text: `마감 ${date} (D-${daysLeft})`, urgent: daysLeft <= 7 };
}
