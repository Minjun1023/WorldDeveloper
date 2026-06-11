import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JobActionCard } from "@/components/job/JobActionCard";
import type { JobDetail } from "@/lib/types";

function job(overrides: Partial<JobDetail> = {}): JobDetail {
  return {
    id: "a:b:1",
    title: "Backend Engineer",
    company: { slug: "acme", display_name: "Acme" },
    location: "Berlin",
    is_remote: false,
    tags: [],
    apply_url: "https://x",
    ...overrides,
  } as JobDetail;
}

describe("JobActionCard 경력/근무형태", () => {
  it("경력·근무형태가 있으면 행으로 보여준다", () => {
    render(<JobActionCard job={job({ experience_years: 5, seniority: "Senior", employment_type: "FULLTIME" })} loggedIn={false} />);
    expect(screen.getByText("경력")).toBeInTheDocument();
    expect(screen.getByText(/5년\+/)).toBeInTheDocument();
    expect(screen.getByText(/시니어/)).toBeInTheDocument();
    expect(screen.getByText("근무형태")).toBeInTheDocument();
    expect(screen.getByText("정규직")).toBeInTheDocument();
  });

  it("경력 0이면 신입으로 표기", () => {
    render(<JobActionCard job={job({ experience_years: 0 })} loggedIn={false} />);
    expect(screen.getByText("신입")).toBeInTheDocument();
  });

  it("seniority Entry/New Grad 는 신입으로 표기", () => {
    render(<JobActionCard job={job({ seniority: "Entry" })} loggedIn={false} />);
    expect(screen.getByText("신입")).toBeInTheDocument();
  });

  it("seniority Intern 은 인턴으로 표기(신입과 구분)", () => {
    render(<JobActionCard job={job({ seniority: "Intern" })} loggedIn={false} />);
    expect(screen.getByText("인턴")).toBeInTheDocument();
  });

  it("데이터 없으면 경력/근무형태 행을 생략한다", () => {
    render(<JobActionCard job={job()} loggedIn={false} />);
    expect(screen.queryByText("경력")).not.toBeInTheDocument();
    expect(screen.queryByText("근무형태")).not.toBeInTheDocument();
  });
});
