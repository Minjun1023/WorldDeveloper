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
        hint: "var(--hint)",
        border: "var(--border)",
        input: "var(--input)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
          tint: "var(--primary-tint)",
        },
        ring: "var(--ring)",
        accent: "var(--accent)",
        section: "var(--section-muted)",
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
        // DESIGN.md: 라틴은 Hanken Grotesk(핀테크 톤), 한글은 Pretendard 폴백.
        sans: [
          "var(--font-hanken)",
          "Hanken Grotesk",
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
          "Noto Serif KR",
          "Nanum Myeongjo",
          "serif",
        ],
      },
      fontSize: {
        // DESIGN.md 타입 스케일 — 헤드라인 타이트 트래킹(-0.02 ~ -0.04em)
        display: ["3.5rem", { lineHeight: "1.1", letterSpacing: "-0.04em", fontWeight: "800" }],
        "display-sm": ["2.75rem", { lineHeight: "1.1", letterSpacing: "-0.035em", fontWeight: "800" }],
        h1: ["2rem", { lineHeight: "1.3", letterSpacing: "-0.03em", fontWeight: "700" }],
        h2: ["1.5rem", { lineHeight: "1.4", letterSpacing: "-0.02em", fontWeight: "700" }],
        h3: ["1.25rem", { lineHeight: "1.5", letterSpacing: "-0.01em", fontWeight: "600" }],
        "body-lg": ["1.0625rem", { lineHeight: "1.6", letterSpacing: "-0.01em" }],
        body: ["0.9375rem", { lineHeight: "1.6" }],
        "body-sm": ["0.875rem", { lineHeight: "1.5" }],
        label: ["0.8125rem", { lineHeight: "1.4", letterSpacing: "0.01em", fontWeight: "600" }],
        caption: ["0.75rem", { lineHeight: "1.4" }],
        mono: ["0.8125rem", { lineHeight: "1.5" }],
      },
      borderRadius: {
        // DESIGN.md rounded 토큰을 그대로: sm .25 / DEFAULT .5 / md .75 / lg 1 / xl 1.5 / full.
        // 표준 요소 16px(lg), 컨테이너 24px(xl), 칩 pill(full).
        sm: "0.25rem",
        DEFAULT: "0.5rem",
        md: "0.75rem",
        lg: "1rem",
        xl: "1.5rem",
        "2xl": "1.5rem", // 앱 카드(rounded-2xl)도 컨테이너 24px로 맞춤
        full: "9999px",
      },
      boxShadow: {
        // DESIGN.md elevation — 초연성(ambient) 소프트 섀도우.
        sm: "0 1px 2px 0 rgb(0 0 0 / 0.04)",
        md: "0 4px 20px rgba(0, 0, 0, 0.04)", // Level 2 (hover/active)
        lg: "0 12px 32px rgba(0, 0, 0, 0.08)", // Level 3 (modals/overlays)
      },
      maxWidth: {
        container: "1200px",
      },
    },
  },
  plugins: [],
};

export default config;
