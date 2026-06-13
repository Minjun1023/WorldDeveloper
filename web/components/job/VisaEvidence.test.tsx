import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VisaEvidence } from "./VisaEvidence";

describe("VisaEvidence", () => {
  it("근거가 있으면 각 줄 + 명부검증 배지", () => {
    render(<VisaEvidence visa={{ status: "sponsors", evidence: ["회사가 UK 스폰서 라이선스 보유 (Home Office 등록 스폰서 명부)"], register_verified: true }} />);
    expect(screen.getByText(/Home Office/)).toBeInTheDocument();
    expect(screen.getByText("명부검증")).toBeInTheDocument();
  });
  it("근거 없으면 렌더 없음", () => {
    const { container } = render(<VisaEvidence visa={{ status: "unclear" }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
