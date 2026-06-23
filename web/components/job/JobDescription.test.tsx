import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JobDescription } from "@/components/job/JobDescription";

const ORIGINAL = "<p>English body content here</p>";

describe("JobDescription", () => {
  it("원문(영문) 본문을 살균해 렌더한다", async () => {
    render(<JobDescription original={ORIGINAL} />);
    expect(await screen.findByText(/English body content here/)).toBeInTheDocument();
  });

  it("번역 토글(한국어/원문)을 노출하지 않는다", () => {
    render(<JobDescription original={ORIGINAL} />);
    expect(screen.queryByRole("button", { name: "한국어" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "원문" })).not.toBeInTheDocument();
  });
});
