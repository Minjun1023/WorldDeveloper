import { describe, expect, it } from "vitest";

import { stripOrphanHeadings } from "./descHtml";

describe("stripOrphanHeadings", () => {
  it("끝의 고아 제목(<p><strong>...:</strong></p>)을 제거한다", () => {
    const out = stripOrphanHeadings(
      "<p>본문 내용.</p><p><strong>개인정보 및 AI 가이드라인:</strong></p>",
    );
    expect(out).toBe("<p>본문 내용.</p>");
  });

  it("빈 문단이 뒤따르는 중간 고아 제목을 제거한다", () => {
    const out = stripOrphanHeadings(
      "<p>본문.</p><p>개인정보 및 AI 가이드라인:</p><p>&nbsp;</p><p>혜택 내용.</p>",
    );
    expect(out).not.toContain("개인정보 및 AI 가이드라인");
    expect(out).toContain("본문.");
    expect(out).toContain("혜택 내용.");
  });

  it("뒤에 본문이 바로 이어지는 제목은 유지한다", () => {
    const html = "<h3>자격 요건:</h3><ul><li>Python</li></ul>";
    expect(stripOrphanHeadings(html)).toBe(html);
  });

  it("콜론으로 끝나지 않는 일반 문단은 건드리지 않는다", () => {
    const html = "<p>마지막 문장입니다.</p>";
    expect(stripOrphanHeadings(html)).toBe(html);
  });

  it("연속된 끝 고아 제목도 모두 제거한다", () => {
    const out = stripOrphanHeadings(
      "<p>본문.</p><p>제목 A:</p><p><strong>제목 B:</strong></p>",
    );
    expect(out).toBe("<p>본문.</p>");
  });

  it("빈 입력은 그대로", () => {
    expect(stripOrphanHeadings("")).toBe("");
  });
});
