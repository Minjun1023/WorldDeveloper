import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export function RecommendCta() {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 text-center">
      <p className="text-body-sm text-muted-foreground">
        스택·연차·선호 지역을 입력하면 6차원 점수로 맞춤 공고를 추천해드려요.
      </p>
      <Link href="/recommend" className={`mt-4 inline-block ${buttonVariants()}`}>
        맞춤 추천 받기
      </Link>
    </div>
  );
}
