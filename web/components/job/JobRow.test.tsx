import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { JobRow } from "@/components/job/JobRow";
import type { Job } from "@/lib/types";

// 급여가 있는 공고. 원화(주) 표시: 204k~255k USD ×1380 ≈ "약 2.8억~3.5억 원"
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
  it("급여가 있으면 메타 줄에 원화로 표시한다(Figma 카드)", () => {
    render(<JobRow job={salariedJob} />);
    expect(screen.getByText(/약 2\.8억~3\.5억 원/)).toBeInTheDocument();
  });

  it("제목(한글)·회사·위치를 표시하고, 영어 원제는 툴팁으로만 제공한다", () => {
    render(<JobRow job={salariedJob} />);
    const title = screen.getByText("백엔드 엔지니어");
    expect(title).toBeInTheDocument();
    // 영어 원제 반복 노출은 제거(밀도·중복) — title 속성으로만 남긴다.
    expect(screen.queryByText("Backend Engineer")).not.toBeInTheDocument();
    expect(title).toHaveAttribute("title", "Backend Engineer");
    expect(screen.getByText(/Acme/)).toBeInTheDocument();
    expect(screen.getByText(/Berlin, Germany/)).toBeInTheDocument();
  });

  it("extraLocations 가 있으면 '외 N개 지역'으로 접어 표기한다", () => {
    render(<JobRow job={salariedJob} extraLocations={2} />);
    expect(screen.getByText("외 2개 지역")).toBeInTheDocument();
  });

  it("관심(저장) 하트 버튼을 렌더한다", () => {
    render(<JobRow job={salariedJob} loggedIn />);
    expect(screen.getByLabelText(/관심 공고/)).toBeInTheDocument();
  });
});
