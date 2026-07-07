import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { ThemeProvider } from "@/components/theme-provider";
import { Hanken_Grotesk } from "next/font/google";

// DESIGN.md: 라틴 글리프는 Hanken Grotesk(핀테크 톤). 한글은 Pretendard(CDN) 폴백.
// Noto Serif KR 은 어떤 화면에서도 사용되지 않아 제거(불필요한 Google Fonts 요청 절감).
const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-hanken",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DevPass — 한국 개발자의 해외 취업, 비자 스폰서십 공고 모음",
  description:
    "비자 스폰서십이 명시된 공고만 모아, 5축 점수로 한국 개발자의 해외 취업을 돕습니다.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* Pretendard(동적 서브셋) — Tailwind font-sans 스택의 1순위. CDN에서 필요한 글리프만 로드. */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body
        className={`${hankenGrotesk.variable} min-h-screen font-sans antialiased`}
      >
        <Providers>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
