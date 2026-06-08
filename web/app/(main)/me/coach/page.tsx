import { CoachChat } from "@/components/coach/CoachChat";
import { getSessionToken } from "@/lib/session-server";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

type PickJob = { id: string; title: string; company: { display_name: string } };

async function fetchPickJobs(token: string): Promise<PickJob[]> {
  const seen = new Map<string, PickJob>();
  try {
    const saved = await fetch(`${BACKEND_URL}/api/v1/me/saved`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (saved.ok) for (const j of (await saved.json()) as PickJob[]) seen.set(j.id, j);
  } catch {
    /* 무시 */
  }
  try {
    const rec = await fetch(`${BACKEND_URL}/api/v1/recommend/me`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ note: null }),
      cache: "no-store",
    });
    if (rec.ok) {
      const data = (await rec.json()) as { recommendations: { job: PickJob }[] };
      for (const r of data.recommendations ?? []) if (!seen.has(r.job.id)) seen.set(r.job.id, r.job);
    }
  } catch {
    /* 무시 */
  }
  return [...seen.values()];
}

export default async function CoachPage() {
  const token = await getSessionToken();
  const jobs = token ? await fetchPickJobs(token) : [];
  return (
    <div className="mx-auto max-w-3xl">
      <CoachChat initialJobs={jobs} />
    </div>
  );
}
