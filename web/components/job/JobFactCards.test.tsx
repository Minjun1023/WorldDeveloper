import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { JobDetail } from "@/lib/types";
import { JobFactCards } from "./JobFactCards";

const base: JobDetail = { id: "x", title: "t", company: { slug: "c", display_name: "C" } };

describe("JobFactCards", () => {
  it("근무지/경력/고용형태 라벨-값 행을 렌더하고 비자 행은 생략한다", () => {
    render(<JobFactCards job={{ ...base, location: "Singapore", employment_type: "FULLTIME", seniority: "Senior", visa: { status: "sponsors" } }} />);
    // 라벨
    expect(screen.getByText("근무지")).toBeInTheDocument();
    expect(screen.getByText("고용형태")).toBeInTheDocument();
    expect(screen.getByText("경력")).toBeInTheDocument();
    // 값: 위치는 compactLocation 한글 단축 표기 + 국기 동반(Singapore → "싱가포르 🇸🇬")
    expect(screen.getByText(/싱가포르/)).toBeInTheDocument();
    expect(screen.getByText("정규직")).toBeInTheDocument();
    expect(screen.getByText("5년+")).toBeInTheDocument();
    // 뷰어블 게이트로 전부 비자 지원 가능이라 비자 행은 노출하지 않는다.
    expect(screen.queryByText(/비자/)).toBeNull();
  });
  it("위치를 한 줄로 압축 (Remote - United States → 원격 · 미국)", () => {
    render(<JobFactCards job={{ ...base, location: "Remote - United States" }} />);
    expect(screen.getByText(/원격 · 미국/)).toBeInTheDocument();
  });
  it("값 없을 때 폴백: 위치 '위치 미표기', 마감 '상시채용', 연봉 '공고 미기재'", () => {
    render(<JobFactCards job={{ ...base }} />);
    expect(screen.getByText("위치 미표기")).toBeInTheDocument();
    expect(screen.getByText("상시채용")).toBeInTheDocument();
    expect(screen.getByText("공고 미기재")).toBeInTheDocument();
  });
  it("연봉이 있으면 원화(주, 파랑) + 달러(보조)로 표시한다", () => {
    render(<JobFactCards job={{ ...base, salary: { min_usd: 279000, max_usd: 377000, currency: "USD" } }} />);
    // 주: 원화 억 단위(파랑). 279k~377k USD ×1380 ≈ 약 3.9억~5.2억 원
    const krwEl = screen.getByText(/약 3\.9억~5\.2억 원/);
    expect(krwEl).toHaveClass("text-primary");
    // 보조: 달러 병기
    expect(screen.getByText("$279k–$377k")).toBeInTheDocument();
  });
});
