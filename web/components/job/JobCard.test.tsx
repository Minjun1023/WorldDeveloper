import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { JobCard } from "./JobCard";
import type { Job } from "@/lib/types";

const base: Job = {
  id: "greenhouse:acme:1",
  title: "Engineering Manager",
  company: { slug: "acme", display_name: "Acme" },
  location: "Berlin",
  employment_type: "FULLTIME",
  seniority: "Senior",
};

describe("JobCard", () => {
  it("기술 태그가 있으면 태그 칩을 보여준다", () => {
    render(<JobCard job={{ ...base, tags: ["python", "aws"] }} />);
    expect(screen.getByText("python")).toBeInTheDocument();
    expect(screen.queryByText("시니어")).not.toBeInTheDocument();
  });

  it("기술 태그가 없으면 레벨 폴백 칩을 보여준다", () => {
    render(<JobCard job={{ ...base, tags: [] }} />);
    expect(screen.getByText("시니어")).toBeInTheDocument();
  });
});
