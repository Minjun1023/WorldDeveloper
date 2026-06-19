import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { JobRow } from "@/components/job/JobRow";
import type { Job } from "@/lib/types";

// 급여가 있는 공고. formatSalary({currency:"USD",min:204000,max:255000}) => "$204k–$255k"
const salariedJob = {
  id: "greenhouse:acme:1",
  title: "Backend Engineer",
  title_ko: "백엔드 엔지니어",
  company: { slug: "acme", display_name: "Acme" },
  location: "Berlin, Germany",
  is_remote: false,
  tags: ["go", "react"],
  salary: { currency: "USD", min: 204000, max: 255000 },
} as unknown as Job;

describe("JobRow", () => {
  it("급여가 있으면 메타 줄에 표시한다(Figma 카드)", () => {
    render(<JobRow job={salariedJob} />);
    expect(screen.getByText(/\$204k/)).toBeInTheDocument();
  });

  it("제목(한글)·영문·회사·위치를 표시한다", () => {
    render(<JobRow job={salariedJob} />);
    expect(screen.getByText("백엔드 엔지니어")).toBeInTheDocument();
    expect(screen.getByText("Backend Engineer")).toBeInTheDocument();
    expect(screen.getByText(/Acme/)).toBeInTheDocument();
    expect(screen.getByText(/Berlin, Germany/)).toBeInTheDocument();
  });

  it("관심(저장) 하트 버튼을 렌더한다", () => {
    render(<JobRow job={salariedJob} loggedIn />);
    expect(screen.getByLabelText(/관심 공고/)).toBeInTheDocument();
  });
});
