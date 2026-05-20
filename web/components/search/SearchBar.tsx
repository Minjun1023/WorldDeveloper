"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUpdateQuery } from "@/lib/use-update-query";

export function SearchBar() {
  const searchParams = useSearchParams();
  const update = useUpdateQuery();
  const [value, setValue] = useState(searchParams.get("q") ?? "");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        update({ q: value.trim() || null });
      }}
      className="flex gap-2"
    >
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="python backend, react senior, ml engineer ..."
        aria-label="공고 검색"
        className="font-mono"
      />
      <Button type="submit">검색</Button>
    </form>
  );
}
