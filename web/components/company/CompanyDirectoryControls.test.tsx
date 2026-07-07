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

  it("분야 메뉴에서 옵션(카운트 표기) 선택 시 tag 로 update 한다", async () => {
    render(<CompanyDirectoryControls tagOptions={tags} />);
    await userEvent.click(screen.getByRole("button", { name: "분야 필터" }));
    // shadcn DropdownMenu(Radix) — 옵션은 role="menuitem". 라벨(좌) + 카운트(우, 콤마) 분리 표시, 괄호 없음.
    const opt = await screen.findByRole("menuitem", { name: /fintech/ });
    expect(opt).toHaveTextContent("40");
    expect(opt).not.toHaveTextContent("(40)");
    await userEvent.click(opt);
    expect(updateMock).toHaveBeenCalledWith({ tag: "fintech" });
  });

  it("정렬 메뉴에서 '이름순' 선택 시 sort=name 으로 update 한다", async () => {
    render(<CompanyDirectoryControls tagOptions={tags} />);
    await userEvent.click(screen.getByRole("button", { name: "정렬" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "이름순" }));
    expect(updateMock).toHaveBeenCalledWith({ sort: "name" });
  });
});
