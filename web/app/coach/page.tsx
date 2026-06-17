import { SiteNav } from "@/components/SiteNav";
import { CoachShell } from "@/components/coach/CoachShell";
import { getSession } from "@/lib/session-server";

export const dynamic = "force-dynamic";

// 이력서 코치 — 다른 화면처럼 전역 navbar(SiteNav) 고정. 그 아래는 앱셸(좌측 사이드바 + 메인)이 화면을 채운다.
// (main) 그룹 밖에 두어 컨테이너/footer 제약 없이 풀블리드로 깔되, navbar 만 동일하게 얹는다.
export default async function CoachPage() {
  const session = await getSession();
  const loggedIn = !!session;
  return (
    <>
      <SiteNav loggedIn={loggedIn} />
      <CoachShell loggedIn={loggedIn} />
    </>
  );
}
