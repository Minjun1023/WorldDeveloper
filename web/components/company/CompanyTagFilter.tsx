"use client";

import { useRouter } from "next/navigation";

import { Dropdown, type DropdownOption } from "@/components/ui/dropdown";

// 기업 디렉터리 분야(카테고리) 필터 — 드롭다운 선택 시 ?tag= 로 navigate.
// 전체(null) 선택은 /companies 로 초기화. 옵션/카운트는 서버에서 집계해 주입.
export function CompanyTagFilter({
  options,
  selected,
}: {
  options: DropdownOption[];
  selected: string | null;
}) {
  const router = useRouter();

  return (
    <div className="w-full sm:w-64">
      <Dropdown
        placeholder="전체 분야"
        options={options}
        value={selected}
        onSelect={(value) =>
          router.push(value ? `/companies?tag=${encodeURIComponent(value)}` : "/companies")
        }
      />
    </div>
  );
}
