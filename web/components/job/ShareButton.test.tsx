import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ShareButton } from "./ShareButton";

describe("ShareButton", () => {
  it("클릭 시 현재 URL 복사 + '복사됨' 표시", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ShareButton />);
    fireEvent.click(screen.getByRole("button", { name: /공유/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(await screen.findByText(/복사됨/)).toBeInTheDocument();
  });
});
