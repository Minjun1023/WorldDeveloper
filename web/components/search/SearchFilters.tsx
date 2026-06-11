"use client";

import { HelpCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { Dropdown } from "@/components/ui/dropdown";
import type { RegionCount } from "@/lib/api";
import { DISCIPLINES } from "@/lib/disciplines";
import { cn } from "@/lib/utils";
import { useUpdateQuery } from "@/lib/use-update-query";
import { VISA_OPTIONS } from "@/lib/visa-options";

const pillBase = "rounded-full border px-3 py-1 text-body-sm transition-colors";

function pillClass(active: boolean) {
  return cn(
    pillBase,
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border text-foreground hover:bg-accent",
  );
}

// 지역 퀵 칩으로 보여줄 상위 지역 수 (원격 제외, 공고 있는 지역)
const TOP_REGIONS = 6;

export function SearchFilters({ regions }: { regions: RegionCount[] }) {
  const searchParams = useSearchParams();
  const update = useUpdateQuery();
  const region = searchParams.get("region");
  const remote = searchParams.get("remote") === "true";
  const includeUnclear = searchParams.get("include_unclear") === "true";
  const verifiedOnly = searchParams.get("verified_only") === "true";
  const minSalary = searchParams.get("min_salary");

  const regionChips = regions.filter((r) => r.value !== "remote").slice(0, TOP_REGIONS);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-40">
          <Dropdown
            placeholder="비자: 전체"
            options={VISA_OPTIONS}
            value={remote ? "remote" : searchParams.get("visa")}
            onSelect={(v) =>
              v === "remote"
                ? update({ remote: "true", visa: null })
                : update({ visa: v, remote: null })
            }
          />
        </div>
        <div className="w-40">
          <Dropdown
            placeholder="전체 직무"
            options={DISCIPLINES}
            value={searchParams.get("discipline")}
            onSelect={(v) => update({ discipline: v })}
          />
        </div>

        {regionChips.length > 0 && (
          <>
            <span className="mx-1 h-5 w-px bg-border" aria-hidden />
            <button type="button" onClick={() => update({ region: null })} className={pillClass(!region)}>
              전체
            </button>
            {regionChips.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => update({ region: r.value })}
                className={pillClass(region === r.value)}
              >
                {r.label}
              </button>
            ))}
          </>
        )}
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        {[
          { v: "100000", label: "$100k+" },
          { v: "150000", label: "$150k+" },
          { v: "200000", label: "$200k+" },
        ].map((c) => (
          <button
            key={c.v}
            type="button"
            onClick={() => update({ min_salary: minSalary === c.v ? null : c.v })}
            className={pillClass(minSalary === c.v)}
            title="급여가 명시된 공고만 보여줘요"
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => update({ remote: remote ? null : "true" })}
          className={pillClass(remote)}
        >
          원격 근무만
        </button>

        <div className="flex items-center gap-2 text-body-sm text-foreground">
          <span>정보 없는 공고 포함</span>
          <span className="group relative inline-flex">
            <button
              type="button"
              aria-label="'정보 없는 공고 포함' 설명 보기"
              className="inline-flex items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <HelpCircle className="h-4 w-4" aria-hidden="true" />
            </button>
            <span
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-64 -translate-x-1/2 rounded-md border border-border bg-surface px-3 py-2 text-left text-caption font-normal leading-relaxed text-muted-foreground shadow-lg group-hover:block group-focus-within:block"
            >
              비자 스폰서십 여부가 공고에 적혀 있지 않은 공고도 결과에 포함해요. 해외 공고
              상당수는 비자 정책을 명시하지 않아, 더 많은 공고를 보려면 켜세요.
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={includeUnclear}
            aria-label="정보 없는 공고 포함"
            onClick={() => update({ include_unclear: includeUnclear ? null : "true" })}
            className={cn(
              "relative inline-flex h-6 w-10 items-center rounded-full transition-colors",
              includeUnclear ? "bg-primary" : "bg-surface-2 border border-border",
            )}
          >
            <span
              className={cn(
                "inline-block h-5 w-5 rounded-full bg-white shadow ring-1 ring-black/5 transition-transform",
                includeUnclear ? "translate-x-[1.125rem]" : "translate-x-0.5",
              )}
            />
          </button>
        </div>

        <div className="flex items-center gap-2 text-body-sm text-foreground">
          <span>명부 검증만</span>
          <span className="group relative inline-flex">
            <button
              type="button"
              aria-label="'명부 검증만' 설명 보기"
              className="inline-flex items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <HelpCircle className="h-4 w-4" aria-hidden="true" />
            </button>
            <span
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-64 -translate-x-1/2 rounded-md border border-border bg-surface px-3 py-2 text-left text-caption font-normal leading-relaxed text-muted-foreground shadow-lg group-hover:block group-focus-within:block"
            >
              정부 공식 스폰서 명부(UK Home Office / US USCIS / NL IND)로 확인된 공고만 봐요.
              가장 확실하지만 명부가 있는 미국·영국·네덜란드 위주로 좁아져요.
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={verifiedOnly}
            aria-label="명부 검증된 공고만"
            onClick={() => update({ verified_only: verifiedOnly ? null : "true" })}
            className={cn(
              "relative inline-flex h-6 w-10 items-center rounded-full transition-colors",
              verifiedOnly ? "bg-primary" : "bg-surface-2 border border-border",
            )}
          >
            <span
              className={cn(
                "inline-block h-5 w-5 rounded-full bg-white shadow ring-1 ring-black/5 transition-transform",
                verifiedOnly ? "translate-x-[1.125rem]" : "translate-x-0.5",
              )}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
