import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VisaBadge } from "@/components/job/VisaBadge";

describe("VisaBadge", () => {
  it("unclear → 중립 '비자 정보 없음' 라벨 + 직접확인 안내 툴팁", () => {
    render(<VisaBadge status="unclear" />);
    const el = screen.getByText("비자 정보 없음");
    expect(el).toBeInTheDocument();
    // 침묵 대신 '검사했지만 본문에 언급 없음'을 정직하게 알리는 툴팁
    expect(el).toHaveAttribute("title");
    expect(el.getAttribute("title")).toMatch(/직접 확인/);
  });

  it("unclear + remoteViable → '비자 불필요' (원격이라 비자 N/A)", () => {
    render(<VisaBadge status="unclear" remoteViable />);
    const el = screen.getByText("비자 불필요");
    expect(el).toBeInTheDocument();
    expect(el.getAttribute("title")).toMatch(/필요 없/);
    expect(screen.queryByText("비자 정보 없음")).not.toBeInTheDocument();
  });

  it("no_sponsor → '스폰서 불가' 경고", () => {
    render(<VisaBadge status="no_sponsor" />);
    expect(screen.getByText("스폰서 불가")).toBeInTheDocument();
  });

  it("sponsors → 아무것도 렌더하지 않음(사이트 기본이 스폰서라 중복 신호 회피)", () => {
    const { container } = render(<VisaBadge status="sponsors" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("status 미정 → 렌더하지 않음", () => {
    const { container } = render(<VisaBadge />);
    expect(container).toBeEmptyDOMElement();
  });
});
