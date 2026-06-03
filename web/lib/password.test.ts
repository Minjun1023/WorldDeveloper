import { describe, expect, it } from "vitest";

import { checkPassword, isPasswordValid } from "@/lib/password";

describe("checkPassword", () => {
  it("flags each rule independently", () => {
    expect(checkPassword("short")).toEqual({
      length: false,
      upper: false,
      lower: true,
      digit: false,
    });
    expect(checkPassword("alllowercase1")).toMatchObject({ upper: false, lower: true, digit: true });
    expect(checkPassword("ALLUPPER123")).toMatchObject({ lower: false, upper: true, digit: true });
    expect(checkPassword("NoDigitsHere")).toMatchObject({ digit: false });
  });

  it("passes a fully compliant password", () => {
    expect(checkPassword("TestPass123")).toEqual({
      length: true,
      upper: true,
      lower: true,
      digit: true,
    });
  });
});

describe("isPasswordValid", () => {
  it("requires all four rules together", () => {
    expect(isPasswordValid("TestPass123")).toBe(true);
  });

  it("rejects when any single rule fails", () => {
    expect(isPasswordValid("Test123")).toBe(false); // too short (< 10)
    expect(isPasswordValid("testpass123")).toBe(false); // no uppercase
    expect(isPasswordValid("TESTPASS123")).toBe(false); // no lowercase
    expect(isPasswordValid("TestPassword")).toBe(false); // no digit
  });
});
