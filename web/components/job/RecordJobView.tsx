"use client";

import { useEffect } from "react";

// 공고 상세 진입 시 서버에 조회 1건 기록(분석/인기 공고용). 마운트 1회, UI 없음, 실패 무시.
export function RecordJobView({ jobId }: { jobId: string }) {
  useEffect(() => {
    fetch(`/api/jobs/${encodeURIComponent(jobId)}/view`, { method: "POST" }).catch(() => {});
  }, [jobId]);
  return null;
}
