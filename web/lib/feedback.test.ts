import { afterEach, describe, expect, it, vi } from "vitest";

import { recordEvents, recordEvent } from "@/lib/feedback";

afterEach(() => vi.restoreAllMocks());

describe("recordEvents", () => {
  it("POSTs a batch to /api/me/feedback and never throws on failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    await recordEvents([{ job_id: "j1", action: "impression", rank: 1, score: 0.9 }]);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/me/feedback");
    expect(JSON.parse(opts.body).events[0].action).toBe("impression");
  });

  it("swallows fetch errors (fire-and-forget)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("net")));
    await expect(recordEvents([{ job_id: "j1", action: "click" }])).resolves.toBeUndefined();
  });

  it("no-ops on empty list", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await recordEvents([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("recordEvent", () => {
  it("wraps a single event into a batch", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    await recordEvent("j2", "apply_click");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).events).toEqual([
      { job_id: "j2", action: "apply_click", rank: undefined, score: undefined },
    ]);
  });
});
