import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JobSummary } from "./JobSummary";

describe("JobSummary", () => {
  it("initialData 있으면 즉시 펼침(버튼 없음)", () => {
    render(<JobSummary jobId="x" initialData={{ job_id: "x", lang: "ko", responsibilities: ["A"], requirements: [], visa: [], compensation: [], engine: "t", cached: true }} />);
    expect(screen.getByText("· A")).toBeInTheDocument();
    expect(screen.queryByText("AI 요약 보기")).not.toBeInTheDocument();
  });
  it("initialData 없으면 버튼 표시", () => {
    render(<JobSummary jobId="x" />);
    expect(screen.getByText("AI 요약 보기")).toBeInTheDocument();
  });
});
