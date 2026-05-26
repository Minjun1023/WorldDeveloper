"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dropdown, type DropdownOption } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import type { RegionCount } from "@/lib/api";
import { DISCIPLINES } from "@/lib/disciplines";
import { useUpdateQuery } from "@/lib/use-update-query";
import { VISA_OPTIONS } from "@/lib/visa-options";

export function SearchBar({ regions }: { regions: RegionCount[] }) {
  const searchParams = useSearchParams();
  const update = useUpdateQuery();
  const [value, setValue] = useState(searchParams.get("q") ?? "");

  const regionOptions: DropdownOption[] = regions.map((r) => ({
    value: r.value,
    label: r.label,
    count: r.count,
  }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        update({ q: value.trim() || null });
      }}
      className="flex flex-col gap-2 sm:flex-row"
    >
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="python backend, react senior, ml engineer ..."
        aria-label="공고 검색"
        className="font-mono sm:flex-1"
      />
      <div className="sm:w-44">
        <Dropdown
          placeholder="지역 선택"
          options={regionOptions}
          value={searchParams.get("region")}
          onSelect={(v) => update({ region: v })}
        />
      </div>
      <div className="sm:w-44">
        <Dropdown
          placeholder="직무 선택"
          options={DISCIPLINES}
          value={searchParams.get("discipline")}
          onSelect={(v) => update({ discipline: v })}
        />
      </div>
      <div className="sm:w-40">
        <Dropdown
          placeholder="비자"
          options={VISA_OPTIONS}
          value={searchParams.get("visa")}
          onSelect={(v) => update({ visa: v })}
        />
      </div>
      <Button type="submit">검색</Button>
    </form>
  );
}
