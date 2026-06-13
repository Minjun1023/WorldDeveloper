import Link from "next/link";

export function SectionHeader({
  title,
  href,
  hrefLabel = "전체 보기",
  count,
  overline,
  subtitle,
}: {
  title: string;
  href?: string;
  hrefLabel?: string;
  count?: number;
  overline?: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          {overline && (
            <div className="mb-1.5 text-caption font-semibold uppercase tracking-wide text-primary">
              {overline}
            </div>
          )}
          <h2 className="flex items-baseline gap-2 text-h1">
            {title}
            {count !== undefined && count > 0 && (
              <span className="text-h3 font-normal text-muted-foreground">
                {count.toLocaleString()}
              </span>
            )}
          </h2>
        </div>
        {href && (
          <Link
            href={href}
            className="group flex shrink-0 items-center gap-1 text-body-sm font-medium text-foreground transition-colors hover:text-primary"
          >
            {hrefLabel}
          </Link>
        )}
      </div>
      {subtitle && <p className="mt-2 text-body-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
