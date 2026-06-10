import { SiteFooter } from "@/components/home/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { getSession } from "@/lib/session-server";

// 랜딩(/) 전용 레이아웃. (main) 과 달리 max-w 컨테이너로 감싸지 않아 섹션이 전폭으로 깔린다.
// 각 섹션이 자체 배경 + 안쪽 컨테이너를 가진다. 리치 푸터는 랜딩에만 적용(다른 페이지는 (main) 유지).
export default async function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  return (
    <>
      <SiteNav loggedIn={!!session} />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
