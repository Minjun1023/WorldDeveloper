"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

export type TagOption = { value: string; label: string; count?: number };

// 기업 디렉터리 분야(카테고리) 필터.
// 네이티브 <select> — 옵션 목록을 브라우저가 렌더하므로 표의 overflow-hidden 에 잘리지 않고,
// 모바일 네이티브 피커 + 접근성까지 공짜. 선택 시 ?tag= 로 navigate, 빈 값은 /companies 초기화.
//
// variant:
//  - "input"  : 테두리 박스(작은 화면 상단 폴백용)
//  - "header" : 고스트(표 헤더의 '분야' 컬럼 라벨처럼 보이도록 무테두리·caption)
export function CompanyTagFilter({
  options,
  selected,
  placeholder,
  variant = "input",
}: {
  options: TagOption[];
  selected: string | null;
  placeholder: string;
  variant?: "input" | "header";
}) {
  const router = useRouter();
  const isHeader = variant === "header";

  return (
    <div className={cn("relative", isHeader ? "w-full" : "w-full sm:w-64")}>
      <select
        aria-label="분야 필터"
        value={selected ?? ""}
        onChange={(e) =>
          router.push(
            e.target.value ? `/companies?tag=${encodeURIComponent(e.target.value)}` : "/companies",
          )
        }
        className={cn(
          "w-full cursor-pointer appearance-none truncate bg-transparent outline-none",
          isHeader
            ? cn(
                "pr-5 text-caption font-medium",
                // 분야가 선택되면(필터 활성) 다른 컬럼 라벨보다 진하게 드러낸다.
                selected ? "text-foreground" : "text-muted-foreground",
              )
            : "rounded-md border border-border bg-surface px-3 py-2 pr-9 text-body-sm text-foreground",
        )}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.count !== undefined && !isHeader ? `${o.label} (${o.count})` : o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground",
          isHeader ? "right-0 h-3.5 w-3.5" : "right-3 h-4 w-4",
        )}
        aria-hidden="true"
      />
    </div>
  );
}
