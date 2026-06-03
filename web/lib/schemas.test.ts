import { describe, expect, it } from "vitest";

import { profileResponseSchema, recommendProfileSchema } from "@/lib/schemas";

describe("recommendProfileSchema", () => {
  it("accepts a full profile", () => {
    const r = recommendProfileSchema.safeParse({
      skills: ["go", "kubernetes"],
      seniority: "senior",
      years_experience: 7,
      preferred_locations: ["germany"],
      remote_preference: "remote",
      desired_salary_usd: 120000,
    });
    expect(r.success).toBe(true);
  });

  it("accepts a minimal profile (skills + seniority only)", () => {
    expect(recommendProfileSchema.safeParse({ skills: [], seniority: "mid" }).success).toBe(true);
  });

  it("rejects when required fields are missing", () => {
    expect(recommendProfileSchema.safeParse({ seniority: "mid" }).success).toBe(false); // no skills
    expect(recommendProfileSchema.safeParse({ skills: ["go"] }).success).toBe(false); // no seniority
  });

  it("rejects invalid numeric ranges and wrong types", () => {
    expect(
      recommendProfileSchema.safeParse({ skills: ["go"], seniority: "mid", years_experience: -1 }).success,
    ).toBe(false);
    expect(
      recommendProfileSchema.safeParse({ skills: "go", seniority: "mid" }).success,
    ).toBe(false); // skills must be array
  });

  it("strips unknown keys (sanitizes forwarded body)", () => {
    const r = recommendProfileSchema.parse({
      skills: ["go"],
      seniority: "mid",
      injected: "x",
    } as Record<string, unknown>);
    expect(r).not.toHaveProperty("injected");
  });
});

describe("profileResponseSchema", () => {
  it("accepts exists=true with a profile", () => {
    const r = profileResponseSchema.safeParse({
      exists: true,
      profile: { skills: ["python"], seniority: "senior" },
    });
    expect(r.success).toBe(true);
  });

  it("accepts exists=false without a profile", () => {
    expect(profileResponseSchema.safeParse({ exists: false }).success).toBe(true);
  });

  it("rejects when exists is missing", () => {
    expect(profileResponseSchema.safeParse({ profile: null }).success).toBe(false);
  });
});
