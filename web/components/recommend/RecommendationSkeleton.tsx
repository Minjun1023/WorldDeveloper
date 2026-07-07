import { Card, CardContent, CardHeader } from "@/components/ui/card";

/** 추천 카드 한 장의 골격 (RecommendationCard 레이아웃을 흉내낸 placeholder). */
function SkeletonCard() {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 shrink-0 rounded-md bg-muted" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-20 rounded bg-muted" />
            <div className="h-4 w-3/4 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-2 w-12 shrink-0 rounded bg-muted" />
              <div className="h-2 flex-1 rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="flex gap-1.5">
          <div className="h-5 w-12 rounded-full bg-muted" />
          <div className="h-5 w-16 rounded-full bg-muted" />
          <div className="h-5 w-10 rounded-full bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * AI 추천 대기 중 표시하는 로딩 골격. NL→프로필 변환 + 5축 점수 계산이 수초 걸려서
 * 빈 화면 대신 진행 상태와 결과 카드 그리드의 placeholder 를 보여준다.
 */
export function RecommendationSkeleton({
  count = 6,
  message = "AI가 분석하고 있어요…",
}: {
  count?: number;
  message?: string;
}) {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <div className="flex items-center gap-2 text-body-sm text-muted-foreground">
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"
          aria-hidden
        />
        {message}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <SkeletonCard />
          </div>
        ))}
      </div>
    </div>
  );
}
