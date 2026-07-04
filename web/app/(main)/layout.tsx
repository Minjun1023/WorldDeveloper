import { Breadcrumb } from "@/components/Breadcrumb";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/home/SiteFooter";
import { getSession } from "@/lib/session-server";

// 일반 페이지 공통 chrome: 전역 navbar + 콘텐츠 컨테이너 + footer.
// 인증 페이지(/signin, /signup)는 이 그룹 밖이라 navbar 없이 풀스크린으로 렌더된다.
// footer 는 랜딩과 동일한 SiteFooter 로 통일(법적 링크 포함, 페이지별 이원화 방지).
export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  return (
    <>
      <SiteNav loggedIn={!!session} />
      <main className="mx-auto max-w-container px-4 py-8">
        <Breadcrumb />
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
