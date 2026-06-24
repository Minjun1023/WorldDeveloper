import { describe, expect, it } from "vitest";

import { filterTechTags } from "./techTags";

describe("filterTechTags", () => {
  it("구체 기술은 유지한다", () => {
    expect(filterTechTags(["spring", "linux", "react"])).toEqual(["spring", "linux", "react"]);
  });

  it("운영 실천/방법론 태그는 제거한다", () => {
    expect(filterTechTags(["spring", "observability", "devops", "sre"])).toEqual(["spring"]);
  });

  it("AI/도메인 전문 분야 태그는 기술 스택으로 유지한다", () => {
    expect(filterTechTags(["machine learning", "observability"])).toEqual(["machine learning"]);
    expect(filterTechTags(["computer vision", "deep learning"])).toEqual([
      "computer vision",
      "deep learning",
    ]);
  });

  it("AI 직무 핵심 신호(mlops·llmops·rag·ai agents·vector database)는 유지한다", () => {
    expect(
      filterTechTags(["llm", "mlops", "rag", "ai agents", "vector database", "observability"]),
    ).toEqual(["llm", "mlops", "rag", "ai agents", "vector database"]);
  });

  it("공고 회사명/슬러그와 같은 태그는 제거한다", () => {
    expect(
      filterTechTags(["datadog", "spring", "linux"], { slug: "datadog", display_name: "Datadog" }),
    ).toEqual(["spring", "linux"]);
  });

  it("대소문자/공백 무시하고 비교한다", () => {
    expect(filterTechTags([" Observability ", "DataDog"], { slug: "datadog" })).toEqual([]);
  });

  it("회사 정보가 없으면 회사명 필터는 건너뛴다", () => {
    expect(filterTechTags(["datadog", "spring"])).toEqual(["datadog", "spring"]);
  });

  it("빈 입력은 빈 배열", () => {
    expect(filterTechTags(undefined)).toEqual([]);
    expect(filterTechTags(null)).toEqual([]);
    expect(filterTechTags([])).toEqual([]);
  });
});
