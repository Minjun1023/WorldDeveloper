import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ScoreRadar } from "@/components/recommend/ScoreRadar";
import type { ScoreBreakdown } from "@/lib/types";

const score: ScoreBreakdown = {
  final_score: 0.8, stack: 0.9, visa: 1, location: 0.5, seniority: 0.7, salary: 0.3, semantic: 0.6,
  penalty_applied: 0, reasons: [], deal_breakers: [],
};

describe("ScoreRadar", () => {
  it("5개 축 라벨을 렌더한다(비자는 매칭 축 아님)", () => {
    render(<ScoreRadar score={score} />);
    for (const label of ["스택", "지역", "레벨", "연봉", "의미"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.queryByText("비자")).not.toBeInTheDocument();
  });

  it("접근성 라벨이 붙은 svg + 5개 데이터 포인트를 그린다", () => {
    const { container } = render(<ScoreRadar score={score} />);
    expect(screen.getByRole("img", { name: "5축 매칭 점수 차트" })).toBeInTheDocument();
    // 5개 축의 데이터 포인트(circle) 5개.
    expect(container.querySelectorAll("circle")).toHaveLength(5);
  });

  it("size prop이 svg 크기에 반영된다", () => {
    const { container } = render(<ScoreRadar score={score} size={116} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "116");
    expect(svg).toHaveAttribute("height", "116");
  });
});
