import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PasswordChangeSection } from "@/components/profile/PasswordChangeSection";

afterEach(() => vi.unstubAllGlobals());

async function openAndFill(current: string, next: string, confirm: string) {
  await userEvent.click(screen.getByRole("button", { name: "비밀번호 변경" }));
  await userEvent.type(screen.getByLabelText("현재 비밀번호"), current);
  await userEvent.type(screen.getByLabelText("새 비밀번호"), next);
  await userEvent.type(screen.getByLabelText("새 비밀번호 확인"), confirm);
}

describe("PasswordChangeSection", () => {
  it("posts to /api/me/account/password and shows success", async () => {
    const f = vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) }));
    vi.stubGlobal("fetch", f);
    render(<PasswordChangeSection />);

    await openAndFill("OldPassword123", "NewPassword456", "NewPassword456");
    await userEvent.click(screen.getByRole("button", { name: "변경하기" }));

    expect(f).toHaveBeenCalledWith(
      "/api/me/account/password",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ currentPassword: "OldPassword123", newPassword: "NewPassword456" }),
      }),
    );
    expect(await screen.findByText("비밀번호가 변경됐어요.")).toBeInTheDocument();
  });

  it("keeps submit disabled when the new password fails the policy or mismatches", async () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<PasswordChangeSection />);

    await openAndFill("OldPassword123", "short", "short"); // 정책 위반
    expect(screen.getByRole("button", { name: "변경하기" })).toBeDisabled();

    await userEvent.clear(screen.getByLabelText("새 비밀번호"));
    await userEvent.type(screen.getByLabelText("새 비밀번호"), "NewPassword456");
    // 확인란은 여전히 "short" → 불일치 안내 + 비활성
    expect(screen.getByText("새 비밀번호가 서로 달라요.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "변경하기" })).toBeDisabled();
  });

  it("shows an error when the current password is wrong (403)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: false, status: 403, json: () => Promise.resolve({}) })),
    );
    render(<PasswordChangeSection />);

    await openAndFill("WrongPass999", "NewPassword456", "NewPassword456");
    await userEvent.click(screen.getByRole("button", { name: "변경하기" }));

    expect(await screen.findByText("현재 비밀번호가 올바르지 않아요.")).toBeInTheDocument();
  });

  it("explains OAuth-only accounts (409)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: false, status: 409, json: () => Promise.resolve({}) })),
    );
    render(<PasswordChangeSection />);

    await openAndFill("Whatever123A", "NewPassword456", "NewPassword456");
    await userEvent.click(screen.getByRole("button", { name: "변경하기" }));

    expect(
      await screen.findByText("소셜 로그인으로 가입한 계정은 비밀번호가 없어요."),
    ).toBeInTheDocument();
  });
});
