import { describe, expect, it } from "vitest";

import { computeCompanyStats } from "@/lib/companyStats";
import type { Job } from "@/lib/types";

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: overrides.id ?? "j",
    title: "Engineer",
    company: { slug: "acme", display_name: "Acme" },
    ...overrides,
  };
}

describe("computeCompanyStats", () => {
  it("returns zeroed stats and null ratio for an empty job list", () => {
    expect(computeCompanyStats([])).toEqual({
      total: 0,
      sponsorRatio: null,
      verifiedCount: 0,
      remoteCount: 0,
      registerVerified: false,
    });
  });

  it("computes sponsor ratio as a rounded percentage", () => {
    const jobs = [
      job({ id: "1", visa: { status: "sponsors" } }),
      job({ id: "2", visa: { status: "sponsors" } }),
      job({ id: "3", visa: { status: "unclear" } }),
    ];
    expect(computeCompanyStats(jobs).sponsorRatio).toBe(67); // 2/3 → 66.6 → 67
  });

  it("counts register-verified jobs and sets the company-level flag", () => {
    const jobs = [
      job({ id: "1", visa: { status: "sponsors", register_verified: true } }),
      job({ id: "2", visa: { status: "sponsors", register_verified: false } }),
    ];
    const stats = computeCompanyStats(jobs);
    expect(stats.verifiedCount).toBe(1);
    expect(stats.registerVerified).toBe(true);
  });

  it("counts a job as remote-capable via is_remote or remote eligibility", () => {
    const jobs = [
      job({ id: "1", is_remote: true }),
      job({ id: "2", remote: { eligibility: "worldwide" } }),
      job({ id: "3", remote: { eligibility: "apac_ok" } }),
      job({ id: "4", remote: { eligibility: "region_restricted" } }),
      job({ id: "5", remote: { eligibility: "unclear" } }), // not counted
      job({ id: "6" }), // not counted
    ];
    expect(computeCompanyStats(jobs).remoteCount).toBe(4);
  });
});
