import { ArrowRight, ExternalLink, MapPin } from "lucide-react";
import Link from "next/link";

import { CompanyLogo } from "@/components/company/CompanyLogo";
import { RegisterVerifiedBadge } from "@/components/job/RegisterVerifiedBadge";
import { Badge } from "@/components/ui/badge";
import { fetchCompanies } from "@/lib/api";
import { COMPANY_LOCATIONS } from "@/lib/company-locations";
import { companyProfile, flagEmoji } from "@/lib/company-profiles";
import { flagFromLocation } from "@/lib/flags";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function CompaniesPage({ searchParams }: { searchParams: SearchParams }) {
  const tag = typeof searchParams.tag === "string" ? searchParams.tag : undefined;
  const data = await fetchCompanies(tag);

  // 카드 신호를 미리 계산하고, '내용 없는' 희소 카드는 디렉터리에서만 숨긴다(공고는 검색/추천에 남음).
  // 위치: 큐레이션 ?? 정적 스냅샷 ?? 백엔드 파생(c.location). 국기: ISO 우선, 없으면 위치 문자열로 추론.
  const enriched = (data?.items ?? []).map((c) => {
    const profile = companyProfile(c.slug);
    const derived = COMPANY_LOCATIONS[c.slug];
    const location = profile?.location ?? derived?.location ?? c.location ?? null;
    const countryIso = profile?.country ?? derived?.country;
    const hasTags = !!(c.tags && c.tags.length > 0);
    const description =
      profile?.description ??
      (hasTags ? `${c.tags!.slice(0, 3).join(" · ")} 분야의 회사예요.` : null);
    const flag = (countryIso ? flagEmoji(countryIso) : "") || (location ? flagFromLocation(location) : "");
    const countryCode = profile?.countryLabel ?? countryIso?.toUpperCase();
    const website = c.website_url
      ? c.website_url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")
      : null;
    const bare = !location && !hasTags && !description && c.job_count <= 1;
    return { c, location, description, flag, countryCode, website, bare };
  });
  const visible = enriched.filter((e) => !e.bare);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-display">회사 디렉터리</h1>
        <p className="mt-2 text-muted-foreground">
          공고가 있는 회사를 모아봤어요. 태그로 원하는 분야의 회사만 좁혀볼 수 있어요.
        </p>
      </section>

      {tag && (
        <div className="flex items-center gap-2 text-body-sm">
          <span className="text-muted-foreground">필터:</span>
          <Badge variant="default">{tag}</Badge>
          <Link href="/companies" className="text-primary hover:underline">
            전체 보기
          </Link>
        </div>
      )}

      {!data ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-body-sm text-muted-foreground">
          회사 목록을 불러오지 못했습니다.
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-body-sm text-muted-foreground">
          해당 조건의 회사가 없습니다.
        </div>
      ) : (
        <>
          <p className="text-caption text-muted-foreground">{visible.length}개 회사</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((e) => {
              const { c, location, description, flag, countryCode, website } = e;
              return (
                <Link
                  key={c.slug}
                  href={`/companies/${c.slug}`}
                  className="group flex h-full flex-col rounded-xl border border-border bg-surface p-5 transition-colors hover:border-primary/40"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <CompanyLogo slug={c.slug} name={c.display_name} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-foreground transition-colors group-hover:text-primary">
                          {c.display_name}
                        </span>
                        {c.verified && <RegisterVerifiedBadge />}
                      </div>
                      {location ? (
                        <span className="mt-0.5 flex items-center gap-1 truncate text-caption text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                          <span className="truncate">{location}</span>
                        </span>
                      ) : website ? (
                        <span className="mt-0.5 inline-flex items-center gap-1 text-caption text-muted-foreground">
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          {website}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {description && (
                    <p className="mt-3 line-clamp-2 text-body-sm text-muted-foreground">
                      {description}
                    </p>
                  )}

                  {c.tags && c.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {c.tags.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-surface-2 px-2.5 py-0.5 text-caption text-muted-foreground"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3 text-caption text-muted-foreground">
                    {flag ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-sm leading-none" aria-hidden="true">
                          {flag}
                        </span>
                        <span className="font-medium text-foreground/70">{countryCode}</span>
                      </span>
                    ) : (
                      <span aria-hidden="true" />
                    )}
                    <span className="inline-flex items-center gap-1.5">
                      <span>{c.job_count}개 공고</span>
                      <ArrowRight className="h-4 w-4 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
