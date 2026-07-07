import Link from "next/link";

export function SectionHeader({
  title,
  href,
  hrefLabel = "더보기",
  count,
  overline,
  subtitle,
  actions,
}: {
  title: string;
  href?: string;
  hrefLabel?: string;
  count?: number;
  overline?: string;
  subtitle?: string;
  // 우측에 붙는 커스텀 컨트롤(버튼 등) — href 링크 대신/함께 사용.
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          {overline && (
            <div className="mb-1 text-caption font-medium text-muted-foreground">
              {overline}
            </div>
          )}
          <h2 className="flex items-baseline gap-2 text-h2">
            {title}
            {count !== undefined && count > 0 && (
              <span className="text-body font-semibold text-primary">
                {count.toLocaleString()}
              </span>
            )}
          </h2>
        </div>
        {(href || actions) && (
          <div className="flex shrink-0 items-center gap-3">
            {actions}
            {href && (
              <Link
                href={href}
                className="group flex shrink-0 items-center gap-1 text-body-sm font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                {hrefLabel}
              </Link>
            )}
          </div>
        )}
      </div>
      {subtitle && <p className="mt-1.5 text-body-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
