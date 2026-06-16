import { FavoriteCompaniesList } from "@/components/company/FavoriteCompaniesList";
import { SavedJobsList } from "@/components/saved/SavedJobsList";

export const dynamic = "force-dynamic";

export default function SavedPage() {
  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-display">저장</h1>
        <p className="mt-2 text-muted-foreground">관심 기업과 저장한 공고를 모아둔 곳이에요.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-h2">관심 기업</h2>
        <FavoriteCompaniesList />
      </section>

      <section className="space-y-3">
        <h2 className="text-h2">저장한 공고</h2>
        <SavedJobsList />
      </section>
    </div>
  );
}
