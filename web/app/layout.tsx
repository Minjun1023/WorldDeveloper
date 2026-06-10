import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { ThemeProvider } from "@/components/theme-provider";
import { Noto_Serif_KR } from "next/font/google";

const notoSerifKr = Noto_Serif_KR({
  weight: ["400", "600"],
  variable: "--font-serif",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "WorldDeveloper — 한국 개발자의 해외 취업, 비자 스폰서십 공고 모음",
  description:
    "비자 스폰서십이 명시된 공고만 모아, 6차원 점수로 한국 개발자의 해외 취업을 돕습니다.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${notoSerifKr.variable} min-h-screen antialiased`}>
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
