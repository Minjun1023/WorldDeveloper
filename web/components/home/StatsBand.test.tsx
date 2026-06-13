import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StatsBand } from "@/components/home/StatsBand";

// CountUp 은 마운트 시 window.matchMedia(jsdom 미구현)를 사용 → 값만 렌더하는 스텁으로 대체.
vi.mock("@/components/home/CountUp", () => ({ CountUp: ({ value }: { value: number }) => <>{value}</> }));

describe("StatsBand", () => {
  it("4개 통계 라벨을 렌더한다", () => {
    render(<StatsBand stats={{ sponsors: 4349, total: 5191, companies: 254, countries: 17 }} />);
    for (const label of ["스폰서십 명시 공고", "전체 공고", "검증된 회사", "진출 국가"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("값이 0인 항목은 제외한다", () => {
    render(<StatsBand stats={{ sponsors: 100, total: 0, companies: 0, countries: 5 }} />);
    expect(screen.getByText("스폰서십 명시 공고")).toBeInTheDocument();
    expect(screen.getByText("진출 국가")).toBeInTheDocument();
    expect(screen.queryByText("전체 공고")).not.toBeInTheDocument();
    expect(screen.queryByText("검증된 회사")).not.toBeInTheDocument();
  });
});
