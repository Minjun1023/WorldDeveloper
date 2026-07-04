import { redirect } from "next/navigation";

// 지원 현황은 북마크의 '공고 관리' 칸반으로 통합 — 같은 데이터(지원 상태)를 두 화면이
// 따로 보여주던 중복을 제거한다. 구 링크 호환을 위해 라우트는 리다이렉트로 유지.
export default function MyApplicationsPage() {
  redirect("/bookmarks?tab=tracker");
}
