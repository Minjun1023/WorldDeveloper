import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VerifyMethodology } from "@/components/home/VerifyMethodology";

describe("VerifyMethodology", () => {
  it("3단계(정부 명부·공고 원문·6차원 점수)를 STEP 번호와 함께 렌더한다", () => {
    render(<VerifyMethodology />);
    expect(screen.getByText("정부 명부 교차 검증")).toBeInTheDocument();
    expect(screen.getByText("공고 원문 분류")).toBeInTheDocument();
    expect(screen.getByText("6차원 점수 계산")).toBeInTheDocument();
    for (const n of ["STEP 01", "STEP 02", "STEP 03"]) {
      expect(screen.getByText(n)).toBeInTheDocument();
    }
  });

  it("실제 검증 출처(USCIS·Home Office·IND)를 정직하게 명시한다", () => {
    render(<VerifyMethodology />);
    expect(screen.getByText(/USCIS H-1B/)).toBeInTheDocument();
    expect(screen.getByText(/Home Office/)).toBeInTheDocument();
    expect(screen.getByText(/IND/)).toBeInTheDocument();
  });
});
