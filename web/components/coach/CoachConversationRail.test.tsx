import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CoachConversationRail } from "@/components/coach/CoachConversationRail";

const items = [
  { job_id: "j1", company: "Stripe", title: "Backend", last_active_at: "2026-06-24T00:00:00Z", preview: "이력서 봐주세요" },
];

describe("CoachConversationRail", () => {
  it("대화 목록을 렌더하고 클릭 시 onSelect(jobId) 호출", async () => {
    const onSelect = vi.fn();
    render(
      <CoachConversationRail items={items} activeJobId={null} onSelect={onSelect} onNew={() => {}} onDelete={() => {}} />,
    );
    expect(screen.getByText("Stripe")).toBeInTheDocument();
    expect(screen.getByText("Backend")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Backend"));
    expect(onSelect).toHaveBeenCalledWith("j1");
  });

  it("새 상담 버튼이 onNew 를 호출", async () => {
    const onNew = vi.fn();
    render(
      <CoachConversationRail items={[]} activeJobId={null} onSelect={() => {}} onNew={onNew} onDelete={() => {}} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /새 상담/ }));
    expect(onNew).toHaveBeenCalled();
  });

  it("항목별 삭제 버튼 클릭 시 onDelete(jobId) 호출", async () => {
    const onDelete = vi.fn();
    render(
      <CoachConversationRail items={items} activeJobId={null} onSelect={() => {}} onNew={() => {}} onDelete={onDelete} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "상담 삭제" }));
    expect(onDelete).toHaveBeenCalledWith("j1");
  });
});
