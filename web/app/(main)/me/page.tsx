import { User } from "lucide-react";
import Link from "next/link";

// 내 정보 허브: 프로필 진입. (지원 현황은 /bookmarks 공고관리 칸반으로 일원화)
export default function MeHomePage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-h1">내 정보</h1>
        <p className="mt-1 text-body-sm text-muted-foreground">추천 정확도를 높이는 프로필을 관리하세요.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/me/profile"
          className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <User className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="font-bold text-foreground group-hover:text-primary">프로필</span>
            <span className="mt-0.5 block text-body-sm text-muted-foreground">추천 정확도를 높이는 기본 정보</span>
          </span>
        </Link>
      </div>
    </div>
  );
}
