"use client";

import { ExternalLink } from "lucide-react";

// 지원하기 버튼 — 원본 지원 페이지를 새 탭으로 열고(앱은 그대로 유지),
// 로그인 상태면 백그라운드로 "저장 + 지원완료" 추적에 자동 기록한다(공고 관리 칸반 '지원완료'에 표시).
// fire-and-forget: 추적 실패가 지원 이동을 막지 않도록 await/preventDefault 하지 않는다.
export function ApplyButton({
  jobId,
  applyUrl,
  loggedIn,
  className,
  disabledClassName,
}: {
  jobId: string;
  applyUrl?: string;
  loggedIn: boolean;
  className: string;
  disabledClassName: string;
}) {
  if (!applyUrl) {
    return (
      <div aria-disabled="true" className={disabledClassName}>
        지원 링크 미제공
      </div>
    );
  }

  function handleApply() {
    if (!loggedIn) return; // 비로그인은 추적 불가 — 지원 이동만
    // 칸반 '지원완료'에 보이려면 저장(PUT)도 필요(보드가 저장 공고 기준).
    fetch(`/api/me/saved/${encodeURIComponent(jobId)}`, { method: "PUT" }).catch(() => {});
    fetch("/api/me/applications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ job_id: jobId, status: "applied" }),
    }).catch(() => {});
  }

  return (
    <a
      href={applyUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleApply}
      className={className}
    >
      지원하기 <ExternalLink className="h-4 w-4" aria-hidden="true" />
    </a>
  );
}
