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
    expect(screen.queryByText("5년+")).not.toBeInTheDocument();
  });

  it("기술 태그가 없으면 레벨 폴백 칩을 보여준다", () => {
    render(<JobCard job={{ ...base, tags: [] }} />);
    expect(screen.getByText("5년+")).toBeInTheDocument();
  });

  it("기술 태그도 레벨/고용형태도 없으면 폴백 칩을 보여주지 않는다", () => {
    const { container } = render(
      <JobCard job={{ ...base, tags: [], seniority: null, employment_type: undefined }} />,
    );
    expect(screen.queryByText("5년+")).not.toBeInTheDocument();
    expect(screen.queryByText("정규직")).not.toBeInTheDocument();
    expect(container.querySelector('[class*="bg-muted"]')).toBeNull();
  });
});
