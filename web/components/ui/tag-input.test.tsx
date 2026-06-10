import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TagInput } from "@/components/ui/tag-input";

describe("TagInput", () => {
  it("adds a trimmed tag on Enter and calls onChange", async () => {
    const onChange = vi.fn();
    render(<TagInput id="t" label="기술 스택" value={[]} onChange={onChange} />);
    await userEvent.type(screen.getByLabelText("기술 스택"), "go{Enter}");
    expect(onChange).toHaveBeenCalledWith(["go"]);
  });

  it("ignores duplicates", async () => {
    const onChange = vi.fn();
    render(<TagInput id="t" label="기술 스택" value={["go"]} onChange={onChange} />);
    await userEvent.type(screen.getByLabelText("기술 스택"), "go{Enter}");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("removes a tag when its ✕ is clicked", async () => {
    const onChange = vi.fn();
    render(<TagInput id="t" label="기술 스택" value={["go", "rust"]} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "go 제거" }));
    expect(onChange).toHaveBeenCalledWith(["rust"]);
  });
});
