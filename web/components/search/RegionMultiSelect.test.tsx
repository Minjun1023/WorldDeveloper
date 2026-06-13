import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RegionMultiSelect } from "@/components/search/RegionMultiSelect";
import type { RegionCount } from "@/lib/api";

const regions: RegionCount[] = [
  { value: "us", label: "미국", count: 100 },
  { value: "germany", label: "독일", count: 50 },
  { value: "remote", label: "원격", count: 30 }, // 제외돼야 함(근무형태)
  { value: "spain", label: "스페인", count: 0 }, // 제외돼야 함(0건)
];

describe("RegionMultiSelect", () => {
  it("국가만 노출(원격·0건 제외), 트리거 기본 라벨은 '전체 지역'", async () => {
    render(<RegionMultiSelect regions={regions} value={null} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "지역 선택" })).toHaveTextContent("전체 지역");
    await userEvent.click(screen.getByRole("button", { name: "지역 선택" }));
    expect(screen.getByRole("checkbox", { name: "미국" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "독일" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "원격" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "스페인" })).not.toBeInTheDocument();
  });

  it("여러 국가 체크 후 '적용'에서 콤마 join 으로 1회 onChange(다중 선택)", async () => {
    const onChange = vi.fn();
    render(<RegionMultiSelect regions={regions} value={null} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "지역 선택" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "미국" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "독일" }));
    // 토글만으로는 onChange 호출 안 함(결과 재조회 최소화).
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /적용/ }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("us,germany");
  });

  it("토글 시 트리거 라벨이 로컬 선택을 즉시 반영", async () => {
    render(<RegionMultiSelect regions={regions} value={null} onChange={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "지역 선택" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "미국" }));
    expect(screen.getByRole("button", { name: "지역 선택" })).toHaveTextContent("미국");
    await userEvent.click(screen.getByRole("checkbox", { name: "독일" }));
    expect(screen.getByRole("button", { name: "지역 선택" })).toHaveTextContent("미국 외 1");
  });

  it("'전체 지역'으로 비우고 적용하면 null", async () => {
    const onChange = vi.fn();
    render(<RegionMultiSelect regions={regions} value="us,germany" onChange={onChange} />);
    expect(screen.getByRole("button", { name: "지역 선택" })).toHaveTextContent("미국 외 1");
    await userEvent.click(screen.getByRole("button", { name: "지역 선택" }));
    await userEvent.click(screen.getByRole("button", { name: "전체 지역" }));
    await userEvent.click(screen.getByRole("button", { name: /적용/ }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
