import { BookmarksTabs } from "@/components/bookmarks/BookmarksTabs";

export const dynamic = "force-dynamic";

// 북마크 — 직행 북마크 영역 구조의 탭 페이지(공개 라우트; 로그인 시 내용 채워짐).
export default function BookmarksPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-display">북마크</h1>
      <BookmarksTabs />
    </div>
  );
}
