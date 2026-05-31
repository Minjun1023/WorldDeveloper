import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { postedLabel, deadlineLabel } from "@/lib/jobDates";
import type { Job } from "@/lib/types";

import { CompanyLogo } from "@/components/company/CompanyLogo";

import { VisaBadge } from "./VisaBadge";

function formatSalary(salary?: Job["salary"]): string | null {
  if (!salary) return null;
  const { min_usd, max_usd } = salary;
  if (!min_usd && !max_usd) return null;
  const k = (n: number) => `$${Math.round(n / 1000)}k`;
  if (min_usd && max_usd) return `${k(min_usd)}–${k(max_usd)}`;
  return k((min_usd ?? max_usd)!);
}

export function JobCard({ job }: { job: Job }) {
  const salary = formatSalary(job.salary);
  const posted = postedLabel(job.posted_at);
  const deadline = deadlineLabel(job.closes_at);
  const metaParts = [job.location, job.is_remote ? "Remote" : null].filter(Boolean);

  return (
    <Card className="flex flex-col transition-colors hover:border-primary/40">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <CompanyLogo slug={job.company.slug} name={job.company.display_name} />
            <div className="min-w-0">
              <Link href={`/jobs/${encodeURIComponent(job.id)}`}>
                <CardTitle className="truncate hover:text-primary transition-colors">
                  {job.title}
                </CardTitle>
              </Link>
              <p className="mt-1 text-body-sm text-muted-foreground">
                {job.company.display_name}
                {metaParts.length > 0 ? ` · ${metaParts.join(" · ")}` : ""}
              </p>
            </div>
          </div>
          <VisaBadge status={job.visa?.status} />
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3">
        {job.tags && job.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {job.tags.slice(0, 6).map((t) => (
              <Badge key={t} variant="outline" className="font-mono lowercase">
                {t}
              </Badge>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
          {salary && <span className="font-mono text-foreground">{salary}</span>}
          {posted && <span>{posted}</span>}
          <span className={deadline.urgent ? "text-foreground font-medium" : undefined}>
            {deadline.text}
          </span>
        </div>
      </CardContent>

      <CardFooter>
        <a
          href={job.apply_url ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="text-body-sm font-medium text-primary hover:underline"
        >
          지원 페이지 →
        </a>
      </CardFooter>
    </Card>
  );
}
