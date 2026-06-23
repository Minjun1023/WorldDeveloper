import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VerifyMethodology } from "@/components/home/VerifyMethodology";

describe("VerifyMethodology", () => {
  it("3단계(정부 명부·공고 원문·5축 점수)를 단계 번호와 함께 렌더한다", () => {
    render(<VerifyMethodology />);
    expect(screen.getByText("정부 명부 교차검증")).toBeInTheDocument();
    expect(screen.getByText("공고 원문 분류")).toBeInTheDocument();
    expect(screen.getByText("5축 점수 산출")).toBeInTheDocument();
    for (const n of ["01", "02", "03"]) {
      expect(screen.getByText(n)).toBeInTheDocument();
    }
  });

  it("실제 검증 출처(USCIS·Home Office·IND)를 정직하게 명시한다", () => {
    render(<VerifyMethodology />);
    expect(screen.getByText(/USCIS/)).toBeInTheDocument();
    expect(screen.getByText(/Home Office/)).toBeInTheDocument();
    expect(screen.getByText(/IND/)).toBeInTheDocument();
  });
});
