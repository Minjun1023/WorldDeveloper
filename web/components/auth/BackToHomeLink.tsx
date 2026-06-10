import { ArrowLeft } from "lucide-react";
import Link from "next/link";

// 풀스크린 인증 화면용 홈 복귀 버튼 (모바일에선 브랜드 패널이 숨겨져 유일한 출구).
// 부모(폼 컬럼)에 relative 가 있어야 좌상단에 고정된다.
export function BackToHomeLink() {
  return (
    <Link
      href="/"
      className="absolute left-6 top-6 inline-flex items-center gap-1.5 text-body-sm text-muted-foreground transition-colors hover:text-foreground sm:left-10"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      홈으로
    </Link>
  );
}
