import Link from "next/link";

const TRACKS = [
  {
    href: "/search?track=relocation",
    title: "이주하고 싶어요",
    desc: "비자 스폰서를 받아 현지에서 근무",
  },
  {
    href: "/search?track=remote",
    title: "한국에 살면서 원격",
    desc: "한국 거주자가 지원 가능한 원격 공고",
  },
  {
    href: "/search",
    title: "둘 다 / 아직 모르겠어요",
    desc: "지원 가능한 공고 전체 보기",
  },
];

export function TrackPicker() {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
      {TRACKS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className="group flex flex-1 flex-col rounded-lg border border-border bg-surface px-5 py-4 text-left transition-colors hover:border-primary/60 sm:max-w-xs"
        >
          <span className="font-semibold text-foreground group-hover:text-primary">
            {t.title}
          </span>
          <span className="mt-1 text-body-sm text-muted-foreground">{t.desc}</span>
        </Link>
      ))}
    </div>
  );
}
