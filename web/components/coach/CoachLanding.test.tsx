import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CoachLanding } from "./CoachLanding";

describe("CoachLanding", () => {
  it("가치 제안·기능을 보여주고, 미배포 통계(만들어낸 수치)는 넣지 않는다", () => {
    render(<CoachLanding />);
    expect(screen.getByRole("heading", { name: /합격하는 문장으로/ })).toBeInTheDocument();
    expect(screen.getByText("공고 키워드 매칭")).toBeInTheDocument();
    // 측정값이 없는 통계는 신뢰를 깎으므로 노출하지 않는다(결정 사항).
    expect(screen.queryByText(/통과율/)).not.toBeInTheDocument();
    expect(screen.queryByText(/14,200/)).not.toBeInTheDocument();
    expect(screen.queryByText(/코칭한 이력서/)).not.toBeInTheDocument();
  });
});
