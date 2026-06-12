import { beforeEach, describe, expect, it } from "vitest";

import {
  clearRecommendCache,
  RECOMMEND_TTL_MS,
  readRecommendCache,
  writeRecommendCache,
  type RecommendCache,
} from "@/lib/recommend-cache";
import type { RecommendResponse } from "@/lib/types";

function sampleResult(): RecommendResponse {
  return {
    recommendations: [
      {
        job: { id: "greenhouse:acme:1", title: "Backend Engineer", company: { slug: "acme", display_name: "Acme" } },
        score: { final_score: 0.8 },
      },
    ],
  } as unknown as RecommendResponse;
}

function cache(tsOffsetMs = 0): RecommendCache {
  return {
    result: sampleResult(),
    saved: ["greenhouse:acme:1"],
    reactions: { "greenhouse:acme:2": "dislike" },
    hidden: ["greenhouse:acme:2"],
    ts: Date.now() + tsOffsetMs,
  };
}

describe("recommend-cache", () => {
  beforeEach(() => window.localStorage.clear());

  it("쓴 뒤 읽으면 그대로 복원된다", () => {
    writeRecommendCache("landing", cache());
    const got = readRecommendCache("landing");
    expect(got).not.toBeNull();
    expect(got!.result.recommendations).toHaveLength(1);
    expect(got!.saved).toEqual(["greenhouse:acme:1"]);
    expect(got!.hidden).toEqual(["greenhouse:acme:2"]);
    expect(got!.reactions).toEqual({ "greenhouse:acme:2": "dislike" });
  });

  it("키별로 분리된다", () => {
    writeRecommendCache("landing", cache());
    expect(readRecommendCache("full")).toBeNull();
  });

  it("TTL 초과면 null(만료)", () => {
    writeRecommendCache("landing", cache(-(RECOMMEND_TTL_MS + 1000)));
    expect(readRecommendCache("landing")).toBeNull();
  });

  it("TTL 이내면 유효", () => {
    writeRecommendCache("landing", cache(-(RECOMMEND_TTL_MS - 1000)));
    expect(readRecommendCache("landing")).not.toBeNull();
  });

  it("손상된 JSON 은 null", () => {
    window.localStorage.setItem("wd:rec:landing", "{not json");
    expect(readRecommendCache("landing")).toBeNull();
  });

  it("recommendations 누락 구조는 null", () => {
    window.localStorage.setItem("wd:rec:landing", JSON.stringify({ ts: Date.now(), result: {} }));
    expect(readRecommendCache("landing")).toBeNull();
  });

  it("clear(key)는 해당 키만 삭제", () => {
    writeRecommendCache("landing", cache());
    writeRecommendCache("full", cache());
    clearRecommendCache("landing");
    expect(readRecommendCache("landing")).toBeNull();
    expect(readRecommendCache("full")).not.toBeNull();
  });

  it("clear()는 모든 추천 캐시 삭제(다른 키는 보존)", () => {
    writeRecommendCache("landing", cache());
    writeRecommendCache("full", cache());
    window.localStorage.setItem("unrelated", "keep");
    clearRecommendCache();
    expect(readRecommendCache("landing")).toBeNull();
    expect(readRecommendCache("full")).toBeNull();
    expect(window.localStorage.getItem("unrelated")).toBe("keep");
  });
});
