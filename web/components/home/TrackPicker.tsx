import Link from "next/link";

const TRACKS = [
  {
    href: "/search?track=relocation",
    emoji: "✈️",
    title: "이주하고 싶어요",
    desc: "비자 스폰서를 받아 현지에서 근무",
  },
  {
    href: "/search?track=remote",
    emoji: "🏠",
    title: "한국에 살면서 원격",
    desc: "한국 거주자가 지원 가능한 원격 공고",
  },
  {
    href: "/search",
    emoji: "🧭",
    title: "둘 다 / 아직 모르겠어요",
    desc: "지원 가능한 공고 전체 보기",
  },
];

export function TrackPicker() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {TRACKS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className="rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:border-primary/40"
        >
          <div className="text-2xl">{t.emoji}</div>
          <div className="mt-2 font-semibold text-foreground">{t.title}</div>
          <div className="mt-1 text-body-sm text-muted-foreground">{t.desc}</div>
        </Link>
      ))}
    </div>
  );
}
