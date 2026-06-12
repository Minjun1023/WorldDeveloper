import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearRecentJobs,
  clearRecentSearches,
  getRecentJobs,
  getRecentSearches,
  pushRecentJob,
  pushRecentSearch,
} from "@/lib/recent";

beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

describe("recent jobs", () => {
  const job = (id: string) => ({ id, title: `T${id}`, company: "C", slug: "c" });

  it("최근 본 공고를 최신순으로 저장", () => {
    pushRecentJob(job("a"));
    pushRecentJob(job("b"));
    expect(getRecentJobs().map((j) => j.id)).toEqual(["b", "a"]);
  });

  it("같은 공고는 중복 제거하고 맨 앞으로", () => {
    pushRecentJob(job("a"));
    pushRecentJob(job("b"));
    pushRecentJob(job("a"));
    expect(getRecentJobs().map((j) => j.id)).toEqual(["a", "b"]);
  });

  it("최대 12개로 제한", () => {
    for (let i = 0; i < 20; i++) pushRecentJob(job(`j${i}`));
    expect(getRecentJobs()).toHaveLength(12);
    expect(getRecentJobs()[0].id).toBe("j19");
  });

  it("id 없으면 무시 / clear 동작", () => {
    pushRecentJob({ id: "", title: "x", company: "c", slug: "c" });
    expect(getRecentJobs()).toHaveLength(0);
    pushRecentJob(job("a"));
    clearRecentJobs();
    expect(getRecentJobs()).toHaveLength(0);
  });
});

describe("recent searches", () => {
  it("최근 검색어 최신순·대소문자 무시 중복제거·8개 제한", () => {
    pushRecentSearch("react");
    pushRecentSearch("python");
    pushRecentSearch("React"); // 대소문자 무시 중복 → 맨 앞
    expect(getRecentSearches()).toEqual(["React", "python"]);
    for (let i = 0; i < 10; i++) pushRecentSearch(`q${i}`);
    expect(getRecentSearches()).toHaveLength(8);
  });

  it("빈 검색어 무시 / clear", () => {
    pushRecentSearch("   ");
    expect(getRecentSearches()).toHaveLength(0);
    pushRecentSearch("go");
    clearRecentSearches();
    expect(getRecentSearches()).toHaveLength(0);
  });
});
