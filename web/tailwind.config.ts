import type { Config } from "tailwindcss";

// 토큰 정의는 web/DESIGN.md (Stitch 포맷) 가 single source of truth.
// 색상은 globals.css 의 CSS 변수를 참조 → 라이트/다크 자동 전환.
const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        surface: {
          DEFAULT: "var(--surface)",
          2: "var(--surface-2)",
        },
        foreground: "var(--foreground)",
        "muted-foreground": "var(--muted-foreground)",
        border: "var(--border)",
        input: "var(--input)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        ring: "var(--ring)",
        accent: "var(--accent)",
        success: "var(--success)",
        warning: "var(--warning)",
        destructive: "var(--destructive)",
        verified: "var(--verified)",
        score: {
          stack: "var(--score-stack)",
          visa: "var(--score-visa)",
          location: "var(--score-location)",
          seniority: "var(--score-seniority)",
          salary: "var(--score-salary)",
          semantic: "var(--score-semantic)",
        },
      },
      fontFamily: {
        sans: [
          "Pretendard Variable",
          "Pretendard",
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
        serif: [
          "var(--font-serif)",
          "Source Serif 4",
          "Georgia",
          "serif",
        ],
      },
      fontSize: {
        display: ["2.25rem", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "700" }],
        h1: ["1.875rem", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "700" }],
        h2: ["1.5rem", { lineHeight: "1.3", letterSpacing: "-0.01em", fontWeight: "600" }],
        h3: ["1.25rem", { lineHeight: "1.4", fontWeight: "600" }],
        body: ["1rem", { lineHeight: "1.6" }],
        "body-sm": ["0.875rem", { lineHeight: "1.5" }],
        caption: ["0.75rem", { lineHeight: "1.4" }],
        mono: ["0.8125rem", { lineHeight: "1.5" }],
      },
      borderRadius: {
        sm: "0.25rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        md: "0 2px 8px -1px rgb(0 0 0 / 0.08)",
        lg: "0 8px 24px -4px rgb(0 0 0 / 0.12)",
      },
      maxWidth: {
        container: "1152px",
      },
    },
  },
  plugins: [],
};

export default config;
