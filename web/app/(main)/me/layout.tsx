import { MeSidebar } from "@/components/me/MeSidebar";

// 마이페이지 공통 쉘: 좌측 사이드바 + 콘텐츠 컬럼. (main) 레이아웃의 컨테이너 안에 들어간다.
export default function MeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
      <MeSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
