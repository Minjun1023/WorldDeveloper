import { render, screen } from "@testing-library/react";
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
  it("shows completeness as filled/5", () => {
    render(
      <ProfileFields
        value={{ ...base, skills: ["go"], bio: "hi" }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("2 / 5")).toBeInTheDocument();
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
});
