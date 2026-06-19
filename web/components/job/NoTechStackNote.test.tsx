import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NoTechStackNote } from "./NoTechStackNote";

describe("NoTechStackNote", () => {
  it("기술 스택 미명시 안내를 렌더한다", () => {
    render(<NoTechStackNote />);
    expect(screen.getByText("기술 스택")).toBeInTheDocument();
    expect(screen.getByText(/명시하지 않았어요/)).toBeInTheDocument();
  });
});
