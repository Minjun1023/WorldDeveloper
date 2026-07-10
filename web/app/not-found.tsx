import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// 전역 404 — notFound() 호출(jobs/visa/companies 상세 등)과
// 매칭되지 않는 경로 진입 시 표시. Next 기본 무스타일 404 대체.
export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <p className="text-h1 font-bold tracking-tight text-primary">404</p>
      <h1 className="mt-3 text-h3 font-semibold text-foreground">페이지를 찾을 수 없어요</h1>
      <p className="mt-2 max-w-sm text-body-sm text-muted-foreground">
        주소가 바뀌었거나 삭제된 공고·게시글일 수 있어요.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Link href="/" className={cn(buttonVariants())}>
          홈으로
        </Link>
        <Link href="/search" className={cn(buttonVariants({ variant: "outline" }))}>
          공고 검색하기
        </Link>
      </div>
    </main>
  );
}
