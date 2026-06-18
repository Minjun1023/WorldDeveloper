import { cn } from "@/lib/utils";

// 작성자 이니셜 아바타(순수 컴포넌트 — 서버/클라 양쪽 사용). 닉네임 해시로 색 결정, '익명'은 회색.
const COLORS = [
  "bg-blue-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-fuchsia-500",
];

export function CommunityAvatar({ name, size = 28 }: { name: string; size?: number }) {
  const anon = !name || name === "익명";
  const initial = anon ? "?" : [...name][0] ?? "?";
  let h = 0;
  for (const ch of name ?? "") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const bg = anon ? "bg-muted-foreground" : COLORS[h % COLORS.length];
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white", bg)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {initial}
    </span>
  );
}
