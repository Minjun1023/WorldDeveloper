"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dropdown, type DropdownOption } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import type { RegionCount } from "@/lib/api";
import { DISCIPLINES } from "@/lib/disciplines";

export function HeroSearch({ regions }: { regions: RegionCount[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [region, setRegion] = useState<string | null>(null);
  const [discipline, setDiscipline] = useState<string | null>(null);

  const regionOptions: DropdownOption[] = regions.map((r) => ({
    value: r.value,
    label: r.label,
    count: r.count,
  }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    const kw = q.trim();
    if (kw) params.set("q", kw);
    if (region) params.set("region", region);
    if (discipline) params.set("discipline", discipline);
    const qs = params.toString();
    router.push(qs ? `/search?${qs}` : "/search");
  }

  return (
    <form onSubmit={submit} className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="python backend berlin, react senior ..."
        aria-label="공고 검색"
        className="font-mono sm:flex-1"
      />
      <div className="sm:w-40">
        <Dropdown placeholder="지역 선택" options={regionOptions} value={region} onSelect={setRegion} />
      </div>
      <div className="sm:w-40">
        <Dropdown placeholder="직무 선택" options={DISCIPLINES} value={discipline} onSelect={setDiscipline} />
      </div>
      <Button type="submit">검색</Button>
    </form>
  );
}
