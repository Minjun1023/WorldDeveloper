import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProfileFields } from "@/components/profile/ProfileFields";
import type { RecommendProfile } from "@/lib/types";

const base: RecommendProfile = {
  skills: [],
  seniority: "senior",
  remote_preference: "any",
  preferred_locations: [],
};

describe("ProfileFields", () => {
  it("renders the 신입(entry) seniority option", () => {
    render(<ProfileFields value={base} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "신입" })).toBeInTheDocument();
  });

  it("emits seniority change via Segmented", async () => {
    const onChange = vi.fn();
    render(<ProfileFields value={base} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "junior" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ seniority: "junior" }),
    );
  });

  it("emits bio change", async () => {
    const onChange = vi.fn();
    render(<ProfileFields value={base} onChange={onChange} />);
    await userEvent.type(screen.getByLabelText(/자기소개/), "x");
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ bio: "x" }));
  });

  it("salary slider emits the value, and undefined at 0", () => {
    const onChange = vi.fn();
    const { rerender } = render(<ProfileFields value={base} onChange={onChange} />);
    const slider = screen.getByLabelText("희망 연봉");
    fireEvent.change(slider, { target: { value: "90000" } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ desired_salary_usd: 90000 }),
    );
    // rerender with updated value so the slider reflects the new position
    rerender(
      <ProfileFields
        value={{ ...base, desired_salary_usd: 90000 }}
        onChange={onChange}
      />,
    );
    fireEvent.change(slider, { target: { value: "0" } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ desired_salary_usd: undefined }),
    );
  });
});
