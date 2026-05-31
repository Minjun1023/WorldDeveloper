// 공고 날짜 표기 유틸 (웹 전용, 순수 함수).

function parseDate(iso?: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

// 게시일 상대 표기: 오늘/어제/N일 전(14일 미만), 그 외엔 날짜.
export function postedLabel(posted_at?: string | null): string | null {
  const d = parseDate(posted_at);
  if (!d) return null;
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "오늘 게시";
  if (days === 1) return "어제 게시";
  if (days < 14) return `${days}일 전 게시`;
  return `${d.toLocaleDateString("ko-KR")} 게시`;
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
