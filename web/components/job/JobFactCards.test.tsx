import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { JobDetail } from "@/lib/types";
import { JobFactCards } from "./JobFactCards";

const base: JobDetail = { id: "x", title: "t", company: { slug: "c", display_name: "C" } };

describe("JobFactCards", () => {
  it("비자/위치/경력/고용형태 칩을 렌더", () => {
    render(<JobFactCards job={{ ...base, location: "Singapore", employment_type: "FULLTIME", seniority: "Senior", visa: { status: "sponsors" } }} />);
    expect(screen.getByText("비자 지원 가능")).toBeInTheDocument();
    // 위치는 compactLocation 으로 국가명을 한글 단축 표기 (Singapore → 싱가포르)
    expect(screen.getByText("싱가포르")).toBeInTheDocument();
    expect(screen.getByText("정규직")).toBeInTheDocument();
    expect(screen.getByText("시니어")).toBeInTheDocument();
  });
  it("위치를 한 줄로 압축 (Remote - United States → 원격 · 미국)", () => {
    render(<JobFactCards job={{ ...base, location: "Remote - United States" }} />);
    expect(screen.getByText("원격 · 미국")).toBeInTheDocument();
  });
  it("위치 미표기 시 '위치 미표기' 칩", () => {
    render(<JobFactCards job={{ ...base }} />);
    expect(screen.getByText("위치 미표기")).toBeInTheDocument();
  });
});
