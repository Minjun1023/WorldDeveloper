import { SavedJobsList } from "@/components/saved/SavedJobsList";

export const dynamic = "force-dynamic";

export default function SavedPage() {
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
