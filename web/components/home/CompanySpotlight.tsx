import Link from "next/link";

import { CompanyLogo } from "@/components/company/CompanyLogo";
import { Card, CardContent } from "@/components/ui/card";
import type { CompanySummary } from "@/lib/types";

export function CompanySpotlight({ companies }: { companies: CompanySummary[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {companies.map((c) => (
        <Link key={c.slug} href={`/companies/${c.slug}`}>
          <Card className="h-full transition-colors hover:border-primary/40">
            <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
              <CompanyLogo slug={c.slug} name={c.display_name} size={40} />
              <span className="text-body-sm font-semibold">{c.display_name}</span>
              <span className="text-caption text-muted-foreground">{c.job_count}개 공고</span>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
