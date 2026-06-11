import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const updateMock = vi.fn();
vi.mock("@/lib/use-update-query", () => ({ useUpdateQuery: () => updateMock }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("") }));

import userEvent from "@testing-library/user-event";
import { SortToggle } from "@/components/search/SortToggle";

describe("SortToggle", () => {
  it("연봉순 옵션을 렌더하고 클릭 시 sort=salary 로 업데이트한다", async () => {
    render(<SortToggle />);
    const btn = screen.getByRole("button", { name: "연봉순" });
    expect(btn).toBeInTheDocument();
    await userEvent.click(btn);
    expect(updateMock).toHaveBeenCalledWith({ sort: "salary" });
  });
});
