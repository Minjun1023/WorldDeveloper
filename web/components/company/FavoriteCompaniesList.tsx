"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AlertToggleCard } from "@/components/alerts/AlertToggleCard";
import { CompanyLogo } from "@/components/company/CompanyLogo";
import { LoadError } from "@/components/ui/LoadError";
import { tagLabel } from "@/lib/company-tags";

type FavCompany = {
  slug: string;
  display_name: string;
  tags?: string[];
  job_count: number;
  location?: string | null;
};

// 관심 기업 목록(/bookmarks/companies) — /api/me/favorite-companies 의 회사 요약을 행으로.
export function FavoriteCompaniesList() {
  const [items, setItems] = useState<FavCompany[] | null>(null);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setItems(null);
    setError(false);
    fetch("/api/me/favorite-companies")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d: FavCompany[]) => alive && setItems(Array.isArray(d) ? d : []))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  if (error) {
    return <LoadError message="관심 기업을 불러오지 못했어요" onRetry={() => setReloadKey((k) => k + 1)} />;
  }
  if (items === null) return <p className="text-body-sm text-muted-foreground">불러오는 중…</p>;
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-center">
        <p className="text-body-sm text-muted-foreground">아직 관심 기업이 없어요.</p>
        <Link href="/companies" className="mt-3 inline-block text-body-sm text-primary">
          기업 둘러보러 가기 →
        </Link>
      </div>
    );
  }

  return (
    <div>
      <AlertToggleCard
        endpoint="/api/me/company-alerts"
        title="새 공고 이메일 알림"
        description="관심 기업에 새 공고가 올라오면 매일 아침 이메일로 알려드려요."
      />
      <div className="overflow-hidden rounded-lg border border-border">
      {items.map((c, i) => (
        <Link
          key={c.slug}
          href={`/companies/${c.slug}`}
          className={`group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2 ${
            i > 0 ? "border-t border-border" : ""
          }`}
        >
          <CompanyLogo slug={c.slug} name={c.display_name} size={36} />
          <div className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-foreground group-hover:text-primary">
              {c.display_name}
            </span>
            {c.location && (
              <span className="mt-0.5 block truncate text-caption text-muted-foreground">{c.location}</span>
            )}
          </div>
          <div className="hidden w-44 shrink-0 gap-1.5 overflow-hidden lg:flex">
            {(c.tags ?? []).slice(0, 2).map((t) => (
              <span
                key={t}
                className="truncate rounded-full bg-surface-2 px-2 py-0.5 text-caption text-muted-foreground"
              >
                {tagLabel(t)}
              </span>
            ))}
          </div>
          <div className="w-20 shrink-0 text-right text-body-sm">
            <span className="font-semibold text-foreground">{c.job_count}</span>
            <span className="text-caption text-muted-foreground">개</span>
          </div>
        </Link>
      ))}
      </div>
    </div>
  );
}
