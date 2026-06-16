import { SavedJobsList } from "@/components/saved/SavedJobsList";

export const dynamic = "force-dynamic";

// 저장한 공고(공개 라우트 — 로그인 시 채워짐). 북마크 드롭다운에서 진입.
export default function SavedJobsPage() {
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-display">저장한 공고</h1>
        <p className="mt-2 text-muted-foreground">관심 있게 본 공고를 모아둔 곳이에요.</p>
      </section>
      <SavedJobsList />
    </div>
  );
}
