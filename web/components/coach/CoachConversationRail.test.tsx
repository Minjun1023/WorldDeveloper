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
      <CoachConversationRail items={items} activeJobId={null} onSelect={onSelect} onNew={() => {}} onDelete={() => {}} onCollapse={() => {}} />,
    );
    expect(screen.getByText("Stripe")).toBeInTheDocument();
    expect(screen.getByText("Backend")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Backend"));
    expect(onSelect).toHaveBeenCalledWith("j1");
  });

  it("새 상담 버튼이 onNew 를 호출", async () => {
    const onNew = vi.fn();
    render(
      <CoachConversationRail items={[]} activeJobId={null} onSelect={() => {}} onNew={onNew} onDelete={() => {}} onCollapse={() => {}} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /새 상담/ }));
    expect(onNew).toHaveBeenCalled();
  });

  it("항목별 삭제 버튼 클릭 시 onDelete(jobId) 호출", async () => {
    const onDelete = vi.fn();
    render(
      <CoachConversationRail items={items} activeJobId={null} onSelect={() => {}} onNew={() => {}} onDelete={onDelete} onCollapse={() => {}} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "상담 삭제" }));
    expect(onDelete).toHaveBeenCalledWith("j1");
  });

  it("접기 토글 클릭 시 onCollapse 호출", async () => {
    const onCollapse = vi.fn();
    render(
      <CoachConversationRail items={items} activeJobId={null} onSelect={() => {}} onNew={() => {}} onDelete={() => {}} onCollapse={onCollapse} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "대화기록 접기" }));
    expect(onCollapse).toHaveBeenCalled();
  });

  it("오늘/이전 날짜 그룹 헤더를 보여준다", () => {
    const mixed = [
      { job_id: "j1", company: "Stripe", title: "오늘 상담", last_active_at: new Date().toISOString(), preview: "" },
      { job_id: "j2", company: "Acme", title: "옛 상담", last_active_at: "2026-01-01T00:00:00Z", preview: "" },
    ];
    render(
      <CoachConversationRail items={mixed} activeJobId={null} onSelect={() => {}} onNew={() => {}} onDelete={() => {}} onCollapse={() => {}} />,
    );
    expect(screen.getByText("오늘")).toBeInTheDocument();
    expect(screen.getByText("이전")).toBeInTheDocument();
  });
});
