import { ApplyButton } from "@/components/job/ApplyButton";
import { MobileMatchScore } from "@/components/job/MobileMatchScore";
import { SaveJobButton } from "@/components/job/SaveJobButton";

// 모바일 하단 고정 지원바(lg 미만). safe-area 패딩.
export function MobileApplyBar({ jobId, applyUrl, loggedIn }: { jobId: string; applyUrl?: string; loggedIn: boolean }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
        <MobileMatchScore jobId={jobId} loggedIn={loggedIn} />
        <SaveJobButton jobId={jobId} loggedIn={loggedIn} className="shrink-0" />
        <ApplyButton
          jobId={jobId}
          applyUrl={applyUrl}
          loggedIn={loggedIn}
          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary text-body-sm font-bold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          disabledClassName="flex h-11 flex-1 cursor-not-allowed items-center justify-center rounded-lg bg-surface-2 text-body-sm font-semibold text-muted-foreground"
        />
      </div>
    </div>
  );
}
