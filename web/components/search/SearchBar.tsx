"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dropdown, type DropdownOption } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import type { CountryCount } from "@/lib/api";
import { useUpdateQuery } from "@/lib/use-update-query";

const DISCIPLINES: DropdownOption[] = [
  { value: "backend", label: "백엔드" },
  { value: "frontend", label: "프론트엔드" },
  { value: "fullstack", label: "풀스택" },
  { value: "mobile", label: "모바일" },
  { value: "data-ml", label: "데이터·ML" },
  { value: "devops", label: "DevOps·인프라" },
];

export function SearchBar({ countries }: { countries: CountryCount[] }) {
  const searchParams = useSearchParams();
  const update = useUpdateQuery();
  const [value, setValue] = useState(searchParams.get("q") ?? "");

  const regionOptions: DropdownOption[] = countries.map((c) => ({
    value: c.value,
    label: c.label,
    count: c.count,
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
          value={searchParams.get("location")}
          onSelect={(v) => update({ location: v })}
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
      <Button type="submit">검색</Button>
    </form>
  );
}
