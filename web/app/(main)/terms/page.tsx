import type { Metadata } from "next";

import { TermsArticle } from "@/components/legal/TermsArticle";

export const metadata: Metadata = {
  title: "서비스 이용약관 — WorldDev",
  description: "WorldDeveloper 서비스 이용약관",
};

export default function TermsPage() {
  return <TermsArticle termsKey="service" />;
}
