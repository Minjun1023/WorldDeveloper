import Link from "next/link";

import { CompanyLogo } from "@/components/company/CompanyLogo";
import { RemoteBadge } from "@/components/job/RemoteBadge";
import { VisaBadge } from "@/components/job/VisaBadge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RecommendationItem } from "@/lib/types";

import { ScoreRadar } from "./ScoreRadar";

export function RecommendationCard({
  item,
  rank,
  actions,
}: {
  item: RecommendationItem;
  rank: number;
  actions?: React.ReactNode;
}) {
  const { job, score } = item;
  const meta = [job.company.display_name, job.location_ko ?? job.location, job.is_remote ? "Remote" : null].filter(Boolean);

  return (
    // h-full: 그리드 셀 높이에 맞춰 늘어나 같은 행 카드 높이를 통일(태그/사유 유무로 생기던 들쭉날쭉 제거).
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="flex items-start gap-3">
          <CompanyLogo slug={job.company.slug} name={job.company.display_name} />
          <div className="min-w-0 flex-1">
            {/* 메타 줄: 순위·점수 배지 (왼쪽) + 액션 아이콘 (오른쪽, 제목 위) */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span className="text-caption font-mono text-muted-foreground">#{rank}</span>
                <span className="rounded-md bg-primary px-2 py-0.5 text-caption font-semibold text-primary-foreground">
                  {Math.round(score.final_score * 100)}점
                </span>
                <VisaBadge status={job.visa?.status} />
                <RemoteBadge eligibility={job.remote?.eligibility} />
              </div>
              {actions && <div className="-mr-1 -mt-1 flex shrink-0 items-center gap-0.5">{actions}</div>}
            </div>
            <Link href={`/jobs/${encodeURIComponent(job.id)}`}>
              <CardTitle className="mt-1 line-clamp-2 hover:text-primary transition-colors">
                {job.title_ko ?? job.title}
              </CardTitle>
            </Link>
            {job.title_ko && (
              <p className="mt-0.5 line-clamp-1 text-caption text-muted-foreground">{job.title}</p>
            )}
            <p className="mt-1 line-clamp-2 text-body-sm text-muted-foreground">{meta.join(" · ")}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3">
        <div className="flex justify-center py-1">
          <ScoreRadar score={score} />
        </div>

        {score.reasons.length > 0 && (
          <ul className="space-y-1 text-caption text-muted-foreground">
            {score.reasons.map((r, i) => (
              <li key={i}>
                <span className="font-semibold text-warning">+</span> {r}
              </li>
            ))}
          </ul>
        )}
        {score.deal_breakers.length > 0 && (
          <ul className="space-y-1 text-caption text-destructive">
            {score.deal_breakers.map((d, i) => (
              <li key={i}>- {d}</li>
            ))}
          </ul>
        )}

        {job.tags && job.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {job.tags.slice(0, 5).map((t) => (
              <Badge key={t} variant="outline" className="font-mono lowercase">
                {t}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
