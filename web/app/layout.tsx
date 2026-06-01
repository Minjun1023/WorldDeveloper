import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteNav } from "@/components/SiteNav";
import { getSession } from "@/lib/session-server";
import { Source_Serif_4 } from "next/font/google";

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "WorldDeveloper",
  description: "해외(EU) 진출용 채용 공고 — 한국 개발자 대상",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${sourceSerif.variable} min-h-screen antialiased`}>
       <Providers>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <header className="border-b border-border">
            <div className="mx-auto max-w-container px-4 py-4 flex items-center justify-between">
              <a href="/" className="font-semibold text-lg">WorldDeveloper</a>
              <SiteNav loggedIn={!!session} />
            </div>
          </header>
          <main className="mx-auto max-w-container px-4 py-8">{children}</main>
          <footer className="mx-auto max-w-container px-4 py-8 text-caption text-muted-foreground border-t border-border mt-12">
            Beta — for personal use only. © WorldDeveloper.
          </footer>
        </ThemeProvider>
       </Providers>
      </body>
    </html>
  );
}
