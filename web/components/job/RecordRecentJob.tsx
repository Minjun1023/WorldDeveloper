"use client";

import { useEffect } from "react";

import { pushRecentJob } from "@/lib/recent";

// 공고 상세 진입 시 "최근 본 공고"에 기록(클라 전용, 마운트 1회). UI 없음.
export function RecordRecentJob({ id, title, company, slug }: {
  id: string; title: string; company: string; slug: string;
}) {
  useEffect(() => {
    pushRecentJob({ id, title, company, slug });
  }, [id, title, company, slug]);
  return null;
}
