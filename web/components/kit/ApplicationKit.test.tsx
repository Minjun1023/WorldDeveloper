import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ApplicationKit } from "./ApplicationKit";

// 백엔드는 전역 Jackson SNAKE_CASE 라 응답이 snake_case 다:
// skill_gap, synthesis.fit_summary/skill_strategy/cover_letter/interview_questions,
// job.company.display_name.
const kit = {
  job: { id: "j1", title: "Backend", company: { display_name: "Acme" } },
  visa: { confidence: "verified", message: "명부 검증" },
  skill_gap: { required: ["k8s"], present: ["k8s"], missing: ["rust"] },
  synthesis: {
    fit_summary: "잘 맞음",
    skill_strategy: "기존 경험을 재구성하세요",
    cover_letter: "안녕하세요",
    interview_questions: ["Q1", "Q2"],
  },
};

describe("ApplicationKit", () => {
  it("4종 + 비자 섹션을 렌더", () => {
    render(<ApplicationKit kit={kit} />);
    expect(screen.getByText(/잘 맞음/)).toBeInTheDocument();
    expect(screen.getByText(/명부 검증/)).toBeInTheDocument();
    expect(screen.getByText(/기존 경험을 재구성하세요/)).toBeInTheDocument();
    expect(screen.getByText(/안녕하세요/)).toBeInTheDocument();
    expect(screen.getByText("Q1")).toBeInTheDocument();
    expect(screen.getByText("Q2")).toBeInTheDocument();
    // 미보유 스킬은 skill_gap.missing 에서 읽는다.
    expect(screen.getByText(/rust/)).toBeInTheDocument();
  });

  it("각 섹션의 '다듬기'는 /coach?jobId=<id> 로 이동 (URL 쿼리는 camel)", () => {
    render(<ApplicationKit kit={kit} />);
    const links = screen.getAllByRole("link", { name: "다듬기" });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/coach?jobId=j1");
    }
  });

  it("synthesis 가 null 이면 부분 키트(공고+비자+스킬갭)만 렌더", () => {
    render(<ApplicationKit kit={{ ...kit, synthesis: null }} />);
    expect(screen.getByText(/명부 검증/)).toBeInTheDocument();
    expect(screen.getByText(/rust/)).toBeInTheDocument();
    expect(screen.queryByText(/안녕하세요/)).not.toBeInTheDocument();
    expect(screen.queryByText("Q1")).not.toBeInTheDocument();
  });
});
