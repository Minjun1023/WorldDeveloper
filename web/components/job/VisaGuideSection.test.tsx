import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VisaGuideSection } from "./VisaGuideSection";

describe("VisaGuideSection", () => {
  it("renders guide text, source link with date, and disclaimer", () => {
    render(
      <VisaGuideSection
        guide={{
          text: "독일은 Blue Card 경로가 흔합니다.",
          sources: [{ title: "취업비자", url: "https://x.de", retrieved_at: "2026-06-25" }],
          disclaimer: "법률·이민 자문이 아닙니다. 2026-06-25 기준",
        }}
      />,
    );
    expect(screen.getByText(/Blue Card/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "취업비자" });
    expect(link).toHaveAttribute("href", "https://x.de");
    expect(screen.getByText(/2026-06-25 확인/)).toBeInTheDocument();
    expect(screen.getByText(/법률·이민 자문이 아닙니다/)).toBeInTheDocument();
  });
});
