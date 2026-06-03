import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProfileForm } from "@/components/recommend/ProfileForm";
import type { RecommendProfile } from "@/lib/types";

describe("ProfileForm", () => {
  it("builds a RecommendProfile from inputs, splitting CSV and omitting visa", async () => {
    const onSubmit = vi.fn();
    render(<ProfileForm onSubmit={onSubmit} loading={false} submitLabel="저장" />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("기술 스택 (쉼표)"), "go, kubernetes ,");
    await user.type(screen.getByLabelText("선호 지역 (쉼표)"), "germany, netherlands");
    await user.type(screen.getByLabelText("연차 (선택)"), "7");
    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const arg = onSubmit.mock.calls[0][0] as RecommendProfile;
    expect(arg.skills).toEqual(["go", "kubernetes"]); // trimmed + empty dropped
    expect(arg.preferred_locations).toEqual(["germany", "netherlands"]);
    expect(arg.years_experience).toBe(7);
    expect(arg.seniority).toBe("senior"); // default
    expect(arg.remote_preference).toBe("any"); // default
    // 비자 스폰서십은 폼에서 받지 않고 백엔드가 항상 true 로 강제한다.
    expect(arg).not.toHaveProperty("needs_visa_sponsorship");
  });

  it("prefills inputs from defaultValue", () => {
    render(
      <ProfileForm
        onSubmit={() => {}}
        loading={false}
        defaultValue={{
          skills: ["python", "django"],
          seniority: "mid",
          years_experience: 4,
          preferred_locations: ["us"],
          remote_preference: "remote",
          desired_salary_usd: 90000,
        }}
      />,
    );
    expect(screen.getByLabelText("기술 스택 (쉼표)")).toHaveValue("python, django");
    expect(screen.getByLabelText("선호 지역 (쉼표)")).toHaveValue("us");
    expect(screen.getByLabelText("최소 희망 연봉 (USD)")).toHaveValue(90000);
  });

  it("disables the submit button while loading", () => {
    render(<ProfileForm onSubmit={() => {}} loading submitLabel="저장" />);
    expect(screen.getByRole("button", { name: "추천 계산 중…" })).toBeDisabled();
  });
});
