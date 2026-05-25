import { JobCard } from "@/components/job/JobCard";
import type { Job } from "@/lib/types";

export function JobScrollRow({ jobs }: { jobs: Job[] }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {jobs.map((job) => (
        <div key={job.id} className="w-[300px] shrink-0">
          <JobCard job={job} />
        </div>
      ))}
    </div>
  );
}
