import { BookmarksTabs } from "@/components/bookmarks/BookmarksTabs";
import { getSession } from "@/lib/session-server";

export const dynamic = "force-dynamic";

// 북마크 — 직행 북마크 영역 구조의 탭 페이지. 탭이 최상단(타이틀 없음).
// 공고 관리/북마크 전체/관심 기업은 로그인 필요, 최근 본 공고는 공개.
export default async function BookmarksPage() {
  const session = await getSession();
  return <BookmarksTabs loggedIn={!!session} />;
}
