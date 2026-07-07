import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { buildMailtoHref, CONTACT_EMAIL, ContactForm } from "@/components/home/ContactForm";

describe("buildMailtoHref", () => {
  it("문의 주소·제목·본문(보낸 사람 포함)을 인코딩해 mailto를 만든다", () => {
    const href = buildMailtoHref("me@example.com", "급여 정보 문의합니다");
    expect(href.startsWith(`mailto:${CONTACT_EMAIL}?`)).toBe(true);
    expect(href).toContain(`subject=${encodeURIComponent("[DevPass] 문의")}`);
    // 본문에 보낸 사람 + 메시지가 인코딩되어 들어간다.
    expect(href).toContain(encodeURIComponent("보낸 사람: me@example.com"));
    expect(href).toContain(encodeURIComponent("급여 정보 문의합니다"));
  });

  it("이메일이 비면 '보낸 사람' 줄 없이 본문만 넣는다", () => {
    const href = buildMailtoHref("", "내용만");
    expect(href).not.toContain(encodeURIComponent("보낸 사람"));
    expect(href).toContain(encodeURIComponent("내용만"));
  });
});

describe("ContactForm", () => {
  it("이메일·문의 내용 입력과 전송 버튼, 안내 문구를 렌더한다", () => {
    render(<ContactForm />);
    expect(screen.getByLabelText("이메일")).toBeInTheDocument();
    expect(screen.getByLabelText("문의 내용")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "문의 메일 보내기" })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(CONTACT_EMAIL))).toBeInTheDocument();
  });
});
