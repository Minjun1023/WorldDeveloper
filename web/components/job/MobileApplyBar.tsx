import { ExternalLink } from "lucide-react";

import { SaveJobButton } from "@/components/job/SaveJobButton";

// 모바일 하단 고정 지원바(lg 미만). safe-area 패딩.
export function MobileApplyBar({ jobId, applyUrl, loggedIn }: { jobId: string; applyUrl?: string; loggedIn: boolean }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
        <SaveJobButton jobId={jobId} loggedIn={loggedIn} className="shrink-0" />
        <a href={applyUrl ?? "#"} target="_blank" rel="noopener noreferrer"
          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-primary text-body-sm font-bold text-primary-foreground">
          지원하기 <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
