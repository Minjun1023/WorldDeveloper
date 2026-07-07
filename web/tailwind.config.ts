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
        // shadcn 표준 스킴 — HSL 채널 변수 + <alpha-value> 로 bg-primary/90 같은 알파 모디파이어 지원.
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
          tint: "var(--primary-tint)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        // 레거시 별칭(bg-surface 등) — 사용처 소진 후 제거 예정.
        surface: {
          DEFAULT: "hsl(var(--surface) / <alpha-value>)",
          2: "hsl(var(--surface-2) / <alpha-value>)",
        },
        // 앱 전용 토큰 — hex 변수 직참조(알파 모디파이어 미지원, 기존과 동일).
        hint: "var(--hint)",
        section: "var(--section-muted)",
        success: "var(--success)",
        warning: "var(--warning)",
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
        // serif 웹폰트(Noto Serif KR) 로드는 제거 — 사용처 없음. 시스템 명조 폴백만 유지.
        serif: ["Nanum Myeongjo", "serif"],
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
        // shadcn 표준 스킴 — --radius(0.5rem=8px) 기준. 기존 16/24px 스쿼클에서 컴팩트하게.
        // xl(0.75rem)/2xl(1rem)은 Tailwind 기본값으로 복귀 → 카드류도 자동으로 축소.
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
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
  plugins: [require("tailwindcss-animate")],
};

export default config;
