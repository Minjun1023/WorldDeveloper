import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TechStackMatch } from "./TechStackMatch";

describe("TechStackMatch", () => {
  it("프로필 스킬과 매칭되면 카운트 표시", () => {
    render(<TechStackMatch tags={["python", "sql", "go"]} skills={["Python", "Go"]} />);
    expect(screen.getByText(/매칭 2\/3/)).toBeInTheDocument();
  });
  it("프로필 없으면 태그만(매칭 카운트 없음)", () => {
    render(<TechStackMatch tags={["python", "sql"]} skills={undefined} />);
    expect(screen.getByText("python")).toBeInTheDocument();
    expect(screen.queryByText(/매칭/)).not.toBeInTheDocument();
  });
});
