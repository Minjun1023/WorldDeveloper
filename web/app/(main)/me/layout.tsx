// 마이페이지 공통 쉘 — 단일 컬럼(좌측 '내 페이지' 사이드바 제거, 계정 메뉴로 진입).
export default function MeLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-w-0">{children}</div>;
}
