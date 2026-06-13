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
  it("검색 결과 행에는 급여를 표시하지 않는다", () => {
    render(<JobRow job={salariedJob} />);
    // 급여가 존재해도 어떤 형식으로도 노출되지 않아야 함(연봉 표시/미표시 공고 간 갭 제거).
    expect(screen.queryByText(/\$2\d{2}k/)).not.toBeInTheDocument();
    expect(screen.queryByText(/204k|255k/)).not.toBeInTheDocument();
  });

  it("제목·회사·위치는 그대로 표시한다", () => {
    render(<JobRow job={salariedJob} />);
    expect(screen.getByText("백엔드 엔지니어")).toBeInTheDocument();
    expect(screen.getByText(/Acme/)).toBeInTheDocument();
    expect(screen.getByText(/Berlin, Germany/)).toBeInTheDocument();
  });

  it("레벨(시니어리티)이 있으면 메타 줄에 대문자로 표시한다", () => {
    render(<JobRow job={{ ...salariedJob, seniority: "senior" } as unknown as Job} />);
    expect(screen.getByText(/· Senior/)).toBeInTheDocument();
  });

  it("레벨이 없으면 표시하지 않는다", () => {
    render(<JobRow job={salariedJob} />);
    expect(screen.queryByText(/· Senior/)).not.toBeInTheDocument();
  });
});
