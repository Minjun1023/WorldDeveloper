import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Pagination } from "@/components/search/Pagination";

const { mockUpdate } = vi.hoisted(() => ({ mockUpdate: vi.fn() }));
vi.mock("@/lib/use-update-query", () => ({ useUpdateQuery: () => mockUpdate }));

beforeEach(() => mockUpdate.mockClear());

// totalPages = ceil(total/pageSize) = ceil(360/12) = 30.
const props = (page: number) => ({ page, pageSize: 12, total: 360 }); // 30 pages

describe("Pagination", () => {
  it("페이지 1개면 렌더 안 함", () => {
    const { container } = render(<Pagination page={1} pageSize={12} total={10} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("현재 블록 5개 숫자 노출(1–5), 현재 페이지 강조", () => {
    render(<Pagination {...props(1)} />);
    for (const n of [1, 2, 3, 4, 5]) expect(screen.getByRole("button", { name: String(n) })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "6" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1" })).toHaveAttribute("aria-current", "page");
  });

  it("다음 블록(페이지 7 → 6–10)", () => {
    render(<Pagination {...props(7)} />);
    for (const n of [6, 7, 8, 9, 10]) expect(screen.getByRole("button", { name: String(n) })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "5" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "7" })).toHaveAttribute("aria-current", "page");
  });

  it("숫자 버튼 클릭 → 해당 페이지로(page=3)", async () => {
    render(<Pagination {...props(1)} />);
    await userEvent.click(screen.getByRole("button", { name: "3" }));
    expect(mockUpdate).toHaveBeenCalledWith({ page: "3" });
  });

  it("1페이지로 가면 page 파라미터 제거(null)", async () => {
    render(<Pagination {...props(2)} />);
    await userEvent.click(screen.getByRole("button", { name: "이전" }));
    expect(mockUpdate).toHaveBeenCalledWith({ page: null });
  });

  it("처음/이전은 1페이지에서 비활성, 마지막/다음은 끝페이지에서 비활성", () => {
    const { unmount } = render(<Pagination {...props(1)} />);
    expect(screen.getByRole("button", { name: "첫 페이지" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "이전" })).toBeDisabled();
    unmount();
    render(<Pagination {...props(30)} />);
    expect(screen.getByRole("button", { name: "마지막 페이지" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "다음" })).toBeDisabled();
  });

  it("페이지 입력 점프 + 범위 초과는 마지막으로 클램프", async () => {
    render(<Pagination {...props(1)} />);
    const inp = screen.getByRole("textbox", { name: "이동할 페이지 번호" });
    await userEvent.type(inp, "12");
    await userEvent.click(screen.getByRole("button", { name: "이동" }));
    expect(mockUpdate).toHaveBeenCalledWith({ page: "12" });

    mockUpdate.mockClear();
    await userEvent.type(inp, "9999");
    await userEvent.click(screen.getByRole("button", { name: "이동" }));
    expect(mockUpdate).toHaveBeenCalledWith({ page: "30" }); // totalPages 로 클램프
  });

  it("마지막 블록은 5개 미만(페이지 30 → 26–30)", () => {
    render(<Pagination {...props(30)} />);
    for (const n of [26, 27, 28, 29, 30]) expect(screen.getByRole("button", { name: String(n) })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "31" })).not.toBeInTheDocument();
  });
});
