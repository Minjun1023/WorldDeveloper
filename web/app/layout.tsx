import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "dev-jobs",
  description: "해외(EU) 진출용 채용 공고 — 한국 개발자 대상",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <header className="border-b border-border">
            <div className="mx-auto max-w-container px-4 py-4 flex items-center justify-between">
              <a href="/" className="font-semibold text-lg">dev-jobs</a>
              <nav className="flex items-center gap-3 text-body-sm text-muted-foreground">
                <a href="/" className="hover:text-foreground transition-colors">검색</a>
                <a href="/recommend" className="hover:text-foreground transition-colors">추천</a>
                <a href="/companies" className="hover:text-foreground transition-colors">회사</a>
                <a href="/about" className="hover:text-foreground transition-colors">소개</a>
                <ThemeToggle />
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-container px-4 py-8">{children}</main>
          <footer className="mx-auto max-w-container px-4 py-8 text-caption text-muted-foreground border-t border-border mt-12">
            Beta — for personal use only. © dev-jobs.
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
