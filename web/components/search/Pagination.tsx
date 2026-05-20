"use client";

import { Button } from "@/components/ui/button";
import { useUpdateQuery } from "@/lib/use-update-query";

export function Pagination({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const update = useUpdateQuery();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-3 pt-2">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => update({ page: String(page - 1) })}
      >
        이전
      </Button>
      <span className="text-body-sm text-muted-foreground">
        {page} / {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => update({ page: String(page + 1) })}
      >
        다음
      </Button>
    </div>
  );
}
