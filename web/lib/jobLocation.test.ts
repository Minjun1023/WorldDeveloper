import { describe, expect, it } from "vitest";

import { hasRemoteInText, locationDisplayParts } from "@/lib/jobLocation";

describe("locationDisplayParts", () => {
  it("does not duplicate Remote when location already says remote", () => {
    // 버그 재현: "Remote" + is_remote → "Remote · Remote" 였던 것.
    expect(locationDisplayParts({ location: "Remote", is_remote: true }, "Remote")).toEqual(["Remote"]);
    expect(locationDisplayParts({ location: "Remote - US", is_remote: true })).toEqual(["Remote - US"]);
  });

  it("adds remote label when location has no remote text", () => {
    expect(locationDisplayParts({ location: "Berlin, Germany", is_remote: true })).toEqual(["Berlin, Germany", "원격"]);
    expect(locationDisplayParts({ location: "Berlin, Germany", is_remote: true }, "Remote")).toEqual(["Berlin, Germany", "Remote"]);
  });

  it("prefers location_ko and dedupes against it", () => {
    expect(locationDisplayParts({ location: "Tokyo", location_ko: "도쿄, 일본", is_remote: false })).toEqual(["도쿄, 일본"]);
  });

  it("remote-only when no location", () => {
    expect(locationDisplayParts({ is_remote: true })).toEqual(["원격"]);
    expect(locationDisplayParts({ is_remote: false })).toEqual([]);
  });

  it("detects remote text in ko/en", () => {
    expect(hasRemoteInText("원격")).toBe(true);
    expect(hasRemoteInText("Remote - UK")).toBe(true);
    expect(hasRemoteInText("Seoul")).toBe(false);
    expect(hasRemoteInText(null)).toBe(false);
  });
});
