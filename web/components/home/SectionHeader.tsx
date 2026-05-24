import Link from "next/link";

type Accent = "visa" | "recommend";

const DOT: Record<Accent, string> = {
  visa: "bg-success",
  recommend: "bg-primary",
};

export function SectionHeader({
  title,
  accent,
  href,
  hrefLabel = "전체 보기",
}: {
  title: string;
  accent?: Accent;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="mb-4 flex items-baseline justify-between">
      <h2 className="flex items-center gap-2 text-h2">
        {accent && (
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${DOT[accent]}`}
            aria-hidden
          />
        )}
        {title}
      </h2>
      {href && (
        <Link href={href} className="text-body-sm text-primary hover:underline">
          {hrefLabel} →
        </Link>
      )}
    </div>
  );
}
