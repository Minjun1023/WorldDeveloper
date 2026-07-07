export const metadata = {
  title: "AI 이력서 코치 | DevPass",
  description: "해외 지원용 이력서를 공고에 맞춰 AI 가 코치해드려요.",
};

import { CoachShell } from "@/components/coach/CoachShell";
import { SiteNav } from "@/components/SiteNav";
import { getSession } from "@/lib/session-server";

export const dynamic = "force-dynamic";

// 이력서 코치 — (main) 그룹 밖의 풀스크린 앱. 전역 SiteNav 는 유지하되, 그 아래 영역을
// 뷰포트 높이로 채우는 2단 셸(좌 대화이력 레일 + 우 메인). 마케팅 footer/컨테이너는 없다.
export default async function CoachPage({
  searchParams,
}: {
  searchParams: { jobId?: string };
}) {
  const session = await getSession();
  const loggedIn = !!session;
  return (
    <>
      <SiteNav loggedIn={loggedIn} />
      <CoachShell loggedIn={loggedIn} initialJobId={searchParams.jobId ?? null} />
    </>
  );
}
