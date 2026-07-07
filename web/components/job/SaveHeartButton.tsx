"use client";

import { Bookmark } from "lucide-react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { useSaveJob } from "@/lib/saved-jobs";
import { cn } from "@/lib/utils";

// 잡 행/카드용 관심(저장) 하트. 공유 스토어(useSaveJob)를 읽어 상세·검색·추천 어디서 토글하든
// 동기화된다(initialSaved 는 로드 전 표시값). JobRow 의 stretched-link 위에 떠야 하므로 relative z-10.
const BTN = "relative z-10 shrink-0 [&_svg]:size-[18px]";

export function SaveHeartButton({
  jobId,
  loggedIn,
  initialSaved = false,
}: {
  jobId: string;
  loggedIn: boolean;
  initialSaved?: boolean;
}) {
  const { saved, toggle } = useSaveJob(jobId, loggedIn, initialSaved);

  if (!loggedIn) {
    return (
      <Link
        href={`/signin?callbackUrl=${encodeURIComponent(`/jobs/${encodeURIComponent(jobId)}`)}`}
        aria-label="관심 공고로 저장 (로그인 필요)"
        title="저장하려면 로그인하세요"
        onClick={(e) => e.stopPropagation()}
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), BTN, "text-muted-foreground hover:text-primary")}
      >
        <Bookmark aria-hidden="true" />
      </Link>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }}
      aria-pressed={saved}
      aria-label={saved ? "관심 공고 저장됨" : "관심 공고로 저장"}
      title={saved ? "저장됨 (클릭해 해제)" : "관심 공고로 저장"}
      className={cn(BTN, saved ? "text-primary" : "text-muted-foreground hover:text-primary")}
    >
      <Bookmark className={cn(saved && "fill-current")} aria-hidden="true" />
    </Button>
  );
}
