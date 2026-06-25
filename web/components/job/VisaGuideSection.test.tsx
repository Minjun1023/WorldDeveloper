import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VisaGuideSection } from "./VisaGuideSection";

describe("VisaGuideSection", () => {
  it("renders guide text, a source button-link (no date), and disclaimer", () => {
    render(
      <VisaGuideSection
        guide={{
          text: "독일은 Blue Card 경로가 흔합니다.",
          sources: [{ title: "취업비자", url: "https://x.de", retrieved_at: "2026-06-25" }],
          disclaimer: "법률·이민 자문이 아닙니다. 비자 규정은 자주 바뀝니다. 지원 전 반드시 공식 사이트에서 최신 내용을 확인하세요.",
        }}
      />,
    );
    expect(screen.getByText(/Blue Card/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "취업비자" });
    expect(link).toHaveAttribute("href", "https://x.de");
    expect(link).toHaveAttribute("target", "_blank");
    // 날짜(출처 옆 "· 확인")는 더 이상 표시하지 않는다.
    expect(screen.queryByText(/2026-06-25/)).not.toBeInTheDocument();
    expect(screen.getByText(/법률·이민 자문이 아닙니다/)).toBeInTheDocument();
  });
});
