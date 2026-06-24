import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const updateMock = vi.fn();
vi.mock("@/lib/use-update-query", () => ({ useUpdateQuery: () => updateMock }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("") }));

import userEvent from "@testing-library/user-event";
import { CompanyDirectoryControls } from "@/components/company/CompanyDirectoryControls";

const tags = [
  { value: "fintech", label: "fintech", count: 40 },
  { value: "ai", label: "ai", count: 32 },
];

describe("CompanyDirectoryControls", () => {
  beforeEach(() => updateMock.mockClear());

  it("분야·정렬은 네이티브 select 가 아니라 트리거 버튼이다", () => {
    render(<CompanyDirectoryControls tagOptions={tags} />);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByRole("button", { name: "분야 필터" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "정렬" })).toBeInTheDocument();
  });

  it("분야 모달에서 옵션(카운트 표기) 선택 시 tag 로 update 한다", async () => {
    render(<CompanyDirectoryControls tagOptions={tags} />);
    await userEvent.click(screen.getByRole("button", { name: "분야 필터" }));
    await userEvent.click(screen.getByRole("button", { name: /fintech \(40\)/ }));
    expect(updateMock).toHaveBeenCalledWith({ tag: "fintech" });
  });

  it("정렬 모달에서 '이름순' 선택 시 sort=name 으로 update 한다", async () => {
    render(<CompanyDirectoryControls tagOptions={tags} />);
    await userEvent.click(screen.getByRole("button", { name: "정렬" }));
    await userEvent.click(screen.getByRole("button", { name: "이름순" }));
    expect(updateMock).toHaveBeenCalledWith({ sort: "name" });
  });
});
