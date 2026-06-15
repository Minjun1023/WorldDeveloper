import { fireEvent, render, screen } from "@testing-library/react";
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

  it("한글 별칭(keywords)으로 검색해도 영문 value 가 추가된다", async () => {
    const onChange = vi.fn();
    render(
      <TagInput
        id="loc"
        label="선호 지역"
        value={[]}
        onChange={onChange}
        suggestions={[{ value: "Germany", keywords: ["독일"] }]}
      />,
    );
    const input = screen.getByLabelText("선호 지역");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "독" } });
    const option = await screen.findByRole("option");
    expect(option).toHaveTextContent("Germany");
    fireEvent.mouseDown(option);
    expect(onChange).toHaveBeenCalledWith(["Germany"]);
  });
});
