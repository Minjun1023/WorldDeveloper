import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MemberRecommend } from "@/components/recommend/MemberRecommend";

// useCachedRecommend 훅을 제어 가능한 목으로 대체(네트워크/캐시 우회).
const { mockHook, mockRun, mockRecordEvents } = vi.hoisted(() => ({
  mockHook: vi.fn(),
  mockRun: vi.fn(),
  mockRecordEvents: vi.fn(),
}));
vi.mock("@/lib/use-recommend", () => ({ useCachedRecommend: () => mockHook() }));
vi.mock("@/lib/feedback", () => ({ recordEvents: (...a: unknown[]) => mockRecordEvents(...a) }));

// 카드 본체는 가볍게 스텁 — 더 보기 노출 개수 로직에 집중.
vi.mock("@/components/recommend/InteractiveJobCard", () => ({
  InteractiveJobCard: ({ rank }: { rank: number }) => <div data-testid="job-card">#{rank}</div>,
}));

// visible 항목 N개 생성(카드 스텁은 job.id만 사용).
const makeVisible = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ job: { id: `job-${i + 1}` }, score: { final_score: 0.5 } }));

const baseHook = {
  loading: false,
  needsProfile: false,
  error: null,
  result: { total_candidates: 100, returned: 15, recommendations: [] },
  saved: new Set<string>(),
  reactions: {},
  run: mockRun,
  onSaveChange: vi.fn(),
  onDislike: vi.fn(),
};

beforeEach(() => {
  mockHook.mockReset();
  mockRun.mockReset();
  mockRecordEvents.mockReset();
});

describe("MemberRecommend 더 보기", () => {
  it("처음엔 12개만 노출하고 남은 개수만큼 '더 보기' 버튼을 보여준다", () => {
    mockHook.mockReturnValue({ ...baseHook, visible: makeVisible(15) });
    render(<MemberRecommend />);
    expect(screen.getAllByTestId("job-card")).toHaveLength(12);
    expect(screen.getByRole("button", { name: /더 많은 추천 보기 \(3개 더\)/ })).toBeInTheDocument();
  });

  it("'더 보기'를 누르면 추가로 노출되고, 다 보면 버튼이 사라진다", async () => {
    mockHook.mockReturnValue({ ...baseHook, visible: makeVisible(15) });
    render(<MemberRecommend />);
    await userEvent.click(screen.getByRole("button", { name: /더 많은 추천 보기/ }));
    expect(screen.getAllByTestId("job-card")).toHaveLength(15);
    expect(screen.queryByRole("button", { name: /더 많은 추천 보기/ })).not.toBeInTheDocument();
  });

  it("'더 보기'는 새로 노출된 카드만 임프레션으로 기록한다(과집계 방지)", async () => {
    mockHook.mockReturnValue({ ...baseHook, visible: makeVisible(15) });
    render(<MemberRecommend />);
    await userEvent.click(screen.getByRole("button", { name: /더 많은 추천 보기/ }));
    expect(mockRecordEvents).toHaveBeenCalledTimes(1);
    const batch = mockRecordEvents.mock.calls[0][0] as Array<{ job_id: string; rank: number }>;
    expect(batch).toHaveLength(3); // 13,14,15번만
    expect(batch.map((e) => e.rank)).toEqual([13, 14, 15]);
    expect(batch.every((e) => e.job_id.startsWith("job-"))).toBe(true);
  });

  it("12개 이하면 '더 보기' 버튼이 없다", () => {
    mockHook.mockReturnValue({ ...baseHook, visible: makeVisible(8) });
    render(<MemberRecommend />);
    expect(screen.getAllByTestId("job-card")).toHaveLength(8);
    expect(screen.queryByRole("button", { name: /더 많은 추천 보기/ })).not.toBeInTheDocument();
  });
});
