import type { Metadata } from "next";

import { TermsArticle } from "@/components/legal/TermsArticle";

export const metadata: Metadata = {
  title: "개인정보처리방침 — DevPass",
  description: "DevPass 개인정보 수집 및 이용 안내",
};

export default function PrivacyPage() {
  return <TermsArticle termsKey="privacy" />;
}
