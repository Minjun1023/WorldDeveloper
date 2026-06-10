import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Segmented } from "@/components/ui/segmented";

const OPTS = [
  { value: "any", label: "상관없음" },
  { value: "remote", label: "원격" },
  { value: "onsite", label: "이주" },
];

describe("Segmented", () => {
  it("marks the selected option with aria-pressed", () => {
    render(<Segmented label="원격" options={OPTS} value="remote" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "원격" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "이주" })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onChange with the clicked value", async () => {
    const onChange = vi.fn();
    render(<Segmented label="원격" options={OPTS} value="any" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "이주" }));
    expect(onChange).toHaveBeenCalledWith("onsite");
  });
});
