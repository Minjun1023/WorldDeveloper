import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchCompanies } from "@/lib/api";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function CompaniesPage({ searchParams }: { searchParams: SearchParams }) {
  const tag = typeof searchParams.tag === "string" ? searchParams.tag : undefined;
  const data = await fetchCompanies(tag);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-display">회사 디렉터리</h1>
        <p className="mt-2 text-muted-foreground">
          공고가 있는 회사를 모아봤어요. 태그로 좁힐 수 있어요.
        </p>
      </section>

      {tag && (
        <div className="flex items-center gap-2 text-body-sm">
          <span className="text-muted-foreground">필터:</span>
          <Badge variant="default">{tag}</Badge>
          <Link href="/companies" className="text-primary hover:underline">전체 보기</Link>
        </div>
      )}

      {!data ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-body-sm text-muted-foreground">
          회사 목록을 불러오지 못했습니다.
        </div>
      ) : data.items.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-body-sm text-muted-foreground">
          해당 조건의 회사가 없습니다.
        </div>
      ) : (
        <>
          <p className="text-caption text-muted-foreground">{data.total}개 회사</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((c) => (
              <Link key={c.slug} href={`/companies/${c.slug}`}>
                <Card className="h-full transition-colors hover:border-primary/40">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{c.display_name}</CardTitle>
                      <span className="text-caption text-muted-foreground">{c.job_count}개 공고</span>
                    </div>
                  </CardHeader>
                  {c.tags && c.tags.length > 0 && (
                    <CardContent>
                      <div className="flex flex-wrap gap-1.5">
                        {c.tags.map((t) => (
                          <Badge key={t} variant="outline">{t}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
