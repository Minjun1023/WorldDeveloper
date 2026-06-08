import { SiteNav } from "@/components/SiteNav";
import { getSession } from "@/lib/session-server";

// 일반 페이지 공통 chrome: 전역 navbar + 콘텐츠 컨테이너 + footer.
// 인증 페이지(/signin, /signup)는 이 그룹 밖이라 navbar 없이 풀스크린으로 렌더된다.
export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  return (
    <>
      <SiteNav loggedIn={!!session} />
      <main className="mx-auto max-w-container px-4 py-8">{children}</main>
      <footer className="mx-auto mt-12 max-w-container border-t border-border px-4 py-8 text-caption text-muted-foreground">
        Beta — for personal use only. © WorldDeveloper.
      </footer>
    </>
  );
}
