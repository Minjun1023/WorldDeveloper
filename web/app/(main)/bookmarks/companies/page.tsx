import { FavoriteCompaniesList } from "@/components/company/FavoriteCompaniesList";

export const dynamic = "force-dynamic";

// 관심 기업(공개 라우트 — 로그인 시 채워짐). 북마크 드롭다운에서 진입.
export default function FavoriteCompaniesPage() {
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-display">관심 기업</h1>
        <p className="mt-2 text-muted-foreground">북마크한 기업을 모아둔 곳이에요.</p>
      </section>
      <FavoriteCompaniesList />
    </div>
  );
}
