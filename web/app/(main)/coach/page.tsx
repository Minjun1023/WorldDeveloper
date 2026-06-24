import { CoachShell } from "@/components/coach/CoachShell";
import { getSession } from "@/lib/session-server";

export const dynamic = "force-dynamic";

// 이력서 코치 — (main) 그룹: 전역 SiteNav + footer. 내부는 2단 셸(좌 대화이력 레일 + 우 메인).
export default async function CoachPage({
  searchParams,
}: {
  searchParams: { jobId?: string };
}) {
  const session = await getSession();
  return <CoachShell loggedIn={!!session} initialJobId={searchParams.jobId ?? null} />;
}
