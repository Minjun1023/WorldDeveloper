import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FilterSidebar } from "@/components/search/FilterSidebar";
import type { RegionCount } from "@/lib/api";

const { mockUpdate, params } = vi.hoisted(() => ({
  mockUpdate: vi.fn(),
  params: new URLSearchParams(),
}));
vi.mock("@/lib/use-update-query", () => ({ useUpdateQuery: () => mockUpdate }));
vi.mock("next/navigation", () => ({ useSearchParams: () => params }));

const regions: RegionCount[] = [
  { value: "us", label: "미국", count: 100 },
  { value: "germany", label: "독일", count: 50 },
  { value: "remote", label: "원격", count: 30 }, // 국가에서 제외
  { value: "spain", label: "스페인", count: 0 }, // 0건 제외
];

beforeEach(() => {
  mockUpdate.mockClear();
  [...params.keys()].forEach((k) => params.delete(k));
});

describe("FilterSidebar", () => {
  it("국가/직무/기타 그룹과 국가 체크박스(원격·0건 제외)를 렌더한다(비자 그룹 제거)", () => {
    render(<FilterSidebar regions={regions} />);
    for (const g of ["국가", "직무", "기타"]) expect(screen.getByText(g)).toBeInTheDocument();
    expect(screen.queryByText("비자")).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "미국" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "독일" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "원격" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "스페인" })).not.toBeInTheDocument();
  });

  it("'갱신' 버튼은 선택이 없어도 항상 보이고, 누르면 필터를 초기화한다", async () => {
    render(<FilterSidebar regions={regions} />);
    const btn = screen.getByRole("button", { name: "필터 갱신" });
    expect(btn).toBeInTheDocument();
    await userEvent.click(btn);
    expect(mockUpdate).toHaveBeenCalledWith({
      region: null,
      discipline: null,
      remote: null,
    });
  });

  it("국가는 다중 선택(콤마 join)으로 region 갱신", async () => {
    params.set("region", "us");
    render(<FilterSidebar regions={regions} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "독일" }));
    expect(mockUpdate).toHaveBeenCalledWith({ region: "us,germany" });
  });

  it("직무는 단일 선택(다른 직무 클릭 시 교체)", async () => {
    params.set("discipline", "backend");
    render(<FilterSidebar regions={regions} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "프론트엔드" }));
    expect(mockUpdate).toHaveBeenCalledWith({ discipline: "frontend" });
  });
});
