"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// 푸터 메일과 동일한 문의 주소.
export const CONTACT_EMAIL = "worlddev61@gmail.com";

// 입력값으로 mailto 링크를 구성. 백엔드 메일 발송 인프라가 아직 없어(런칭 시점 연기),
// 사용자의 메일 앱에서 문의 메일을 바로 작성하도록 mailto로 처리한다.
export function buildMailtoHref(email: string, message: string): string {
  const subject = encodeURIComponent("[WorldDeveloper] 문의");
  const from = email.trim() ? `보낸 사람: ${email.trim()}\n\n` : "";
  const body = encodeURIComponent(`${from}${message.trim()}`);
  return `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
}

export function ContactForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    window.location.href = buildMailtoHref(email, message);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-border bg-surface p-5 sm:p-6">
      <div className="space-y-1.5">
        <label htmlFor="contact-email" className="text-body-sm font-medium text-foreground">
          이메일
        </label>
        <Input
          id="contact-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="회신받을 이메일 주소"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="contact-message" className="text-body-sm font-medium text-foreground">
          문의 내용
        </label>
        <textarea
          id="contact-message"
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="제품·공고·제휴 등 궁금한 점이나 의견을 적어주세요."
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-body-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
      <Button type="submit" className="w-full">
        문의 메일 보내기
      </Button>
      <p className="text-caption text-muted-foreground">
        버튼을 누르면 메일 앱에서 {CONTACT_EMAIL} 로 보내는 메일이 작성돼요.
      </p>
    </form>
  );
}
