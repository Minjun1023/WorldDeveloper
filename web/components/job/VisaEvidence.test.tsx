import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VisaEvidence, cleanEvidence } from "./VisaEvidence";

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
  it("저장값에 섞인 원시 HTML 태그/엔티티를 표시 전에 제거", () => {
    render(
      <VisaEvidence
        visa={{
          status: "sponsors",
          evidence: [
            '...> <p><strong data-stringify-type="bold">Visa sponsorship:</strong>&nbsp;We do sponsor visas! How...',
          ],
        }}
      />,
    );
    const el = screen.getByText(/Visa sponsorship/);
    expect(el.textContent).toBe("... Visa sponsorship: We do sponsor visas! How...");
    expect(el.textContent).not.toContain("<");
    expect(el.textContent).not.toContain("&nbsp;");
    expect(el.textContent).not.toContain("data-stringify-type");
  });
  it("태그만 있어 빈 값이 되는 근거는 제거", () => {
    const { container } = render(
      <VisaEvidence visa={{ status: "unclear", evidence: ["<p></p>", "<br/>"] }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("cleanEvidence", () => {
  it("이미 평문이면 그대로(부스러기 없음)", () => {
    expect(cleanEvidence("...We do sponsor visas...")).toBe("...We do sponsor visas...");
  });
  it("태그 제거 + 엔티티 디코드 + 공백 정리", () => {
    expect(cleanEvidence("a &amp; b <em>c</em>&nbsp;d")).toBe("a & b c d");
  });
  it("숫자 엔티티 디코드", () => {
    expect(cleanEvidence("we&#39;re hiring")).toBe("we're hiring");
  });
});
