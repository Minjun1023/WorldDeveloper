import Link from "next/link";

// 랜딩 전용 리치 푸터(4컬럼 + 워터마크). Readdy 목업 대응.
// 카피는 실데이터에 맞춰 정직하게: "유럽 전용"이 아닌 글로벌 진출, 추천은 회원 전용.
const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "제품",
    links: [
      { label: "공고 검색", href: "/search" },
      { label: "맞춤 추천", href: "/recommend" },
      { label: "회사 디렉터리", href: "/companies" },
      { label: "이력서 코치", href: "/me/coach" },
    ],
  },
  {
    title: "탐색",
    links: [
      { label: "비자 스폰서 공고", href: "/search?visa=sponsors" },
      { label: "비자 가이드", href: "/visa" },
      { label: "원격 가능 공고", href: "/search?track=remote" },
      { label: "국가별 공고", href: "/regions" },
      { label: "자주 묻는 질문", href: "/#faq" },
    ],
  },
  {
    title: "회사",
    links: [
      { label: "소개", href: "/" },
      { label: "회원가입", href: "/signup" },
      { label: "로그인", href: "/signin" },
    ],
  },
];

const SOCIALS = [
  { label: "GitHub", href: "https://github.com", Icon: GithubMark },
  { label: "LinkedIn", href: "https://linkedin.com", Icon: LinkedinMark },
  { label: "X", href: "https://x.com", Icon: XMark },
  { label: "이메일", href: "mailto:hello@worlddeveloper.dev", Icon: MailMark },
];

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-border bg-background">
      <div className="mx-auto max-w-container px-4 pt-14 pb-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          {/* 브랜드 */}
          <div>
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
                <GlobeMark />
              </span>
              <span className="text-lg font-bold tracking-tight text-foreground">
                World<span className="text-primary">Dev</span>
              </span>
            </Link>
            <p className="mt-3 max-w-xs text-body-sm leading-relaxed text-muted-foreground">
              비자 스폰서십이 명시된 해외 공고만 모아, 6차원 점수로 한국 개발자의 해외 취업을
              돕습니다.
            </p>
            <div className="mt-4 flex items-center gap-2">
              {SOCIALS.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <Icon />
                </a>
              ))}
            </div>
          </div>

          {/* 링크 컬럼 */}
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-body-sm font-semibold text-foreground">{col.title}</h3>
              <ul className="mt-3 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-body-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-2 border-t border-border pt-6 text-caption text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} WorldDeveloper. All rights reserved.</span>
          <span>Made for Korean developers heading abroad.</span>
        </div>
      </div>

      {/* 하단 워터마크 — Readdy 목업의 거대 텍스트.
          color 알파(text-foreground/[0.03])는 --foreground 가 완전한 hex 라 Tailwind 가
          유효한 rgb(.. / alpha) 로 못 만들어 무시되고 100% 불투명해진다. 대신 요소 opacity 로
          처리하면 라이트/다크 모두에서 옅은 워터마크로 동작한다. */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none px-4 text-center font-bold leading-none tracking-tighter text-foreground opacity-[0.04]"
        style={{ fontSize: "clamp(3rem, 14vw, 11rem)" }}
      >
        WORLDDEVELOPER
      </div>
    </footer>
  );
}

function GlobeMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-[18px] w-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}

// lucide 1.16 에는 브랜드 아이콘이 없어 인라인 SVG 로 직접 그린다.
function GithubMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.25 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.62-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 24 12.5C24 5.87 18.63.5 12 .5Z" />
    </svg>
  );
}
function LinkedinMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14ZM7.12 20.45H3.55V9h3.57v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
    </svg>
  );
}
function XMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.22-6.82-5.96 6.82H1.66l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23Zm-1.16 17.52h1.83L7.01 4.13H5.05l12.03 15.64Z" />
    </svg>
  );
}
function MailMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </svg>
  );
}
