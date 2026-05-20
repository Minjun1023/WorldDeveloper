import Link from "next/link";

import { VisaBadge } from "@/components/job/VisaBadge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RecommendationItem } from "@/lib/types";

import { ScoreBreakdownBars } from "./ScoreBreakdownBars";

export function RecommendationCard({ item, rank }: { item: RecommendationItem; rank: number }) {
  const { job, score } = item;
  const meta = [job.company.display_name, job.location, job.is_remote ? "Remote" : null].filter(Boolean);

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-caption font-mono text-muted-foreground">#{rank}</span>
              <span className="rounded-md bg-primary px-2 py-0.5 text-caption font-semibold text-primary-foreground">
                {Math.round(score.final_score * 100)}점
              </span>
            </div>
            <Link href={`/jobs/${encodeURIComponent(job.id)}`}>
              <CardTitle className="mt-1 truncate hover:text-primary transition-colors">
                {job.title}
              </CardTitle>
            </Link>
            <p className="mt-1 text-body-sm text-muted-foreground">{meta.join(" · ")}</p>
          </div>
          <VisaBadge status={job.visa?.status} />
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3">
        <ScoreBreakdownBars score={score} />

        {score.reasons.length > 0 && (
          <ul className="space-y-1 text-caption text-muted-foreground">
            {score.reasons.map((r, i) => (
              <li key={i}>+ {r}</li>
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
