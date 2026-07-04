export const metadata = {
  title: "최근 본 공고 | WorldDev",
  description: "최근에 열어본 해외 개발자 공고 목록입니다.",
};

import { RecentJobsList } from "@/components/recent/RecentJobsList";
import { fetchRecentViews } from "@/lib/api";
import { getSessionToken } from "@/lib/session-server";

// 최근 본(열람한) 공고.
// - 로그인: 계정 기준 서버 기록(job_views)을 조회 → 어느 기기에서 봐도 동일.
// - 비로그인: 서버 기록이 없으므로 클라에서 localStorage(기기 로컬) 폴백.
export const dynamic = "force-dynamic";

export default async function RecentPage() {
  const token = await getSessionToken();
  const serverJobs = token ? await fetchRecentViews(token) : null;
  return <RecentJobsList serverJobs={serverJobs} />;
}
