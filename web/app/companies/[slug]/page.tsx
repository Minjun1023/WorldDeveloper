import Link from "next/link";
import { notFound } from "next/navigation";

import { JobCard } from "@/components/job/JobCard";
import { Badge } from "@/components/ui/badge";
import { fetchCompany } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function CompanyDetailPage({ params }: { params: { slug: string } }) {
  const data = await fetchCompany(params.slug);
  if (!data) notFound();

  const { company, jobs } = data;

  return (
    <div className="space-y-8">
      <Link href="/companies" className="inline-block text-body-sm text-muted-foreground hover:text-foreground">
        ← 회사 목록
      </Link>

      <header className="space-y-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-h1">{company.display_name}</h1>
          {company.ats && (
            <span className="text-caption font-mono text-muted-foreground">{company.ats}</span>
          )}
        </div>
        {company.tags && company.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {company.tags.map((t) => (
              <Link key={t} href={`/companies?tag=${encodeURIComponent(t)}`}>
                <Badge variant="outline" className="hover:border-primary/40">{t}</Badge>
              </Link>
            ))}
          </div>
        )}
        <div className="flex items-center gap-4 text-body-sm text-muted-foreground">
          <span>{company.job_count}개 공고</span>
          {company.website_url && (
            <a href={company.website_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              웹사이트
            </a>
          )}
        </div>
      </header>

      <section className="space-y-4">
        <h2 className="text-h2">공고</h2>
        {jobs.length === 0 ? (
          <p className="text-body-sm text-muted-foreground">현재 공고가 없습니다.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
