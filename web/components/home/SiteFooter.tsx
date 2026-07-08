import Link from "next/link";

import { BrandMark } from "@/components/BrandMark";

// 전 페이지 공통 리치 푸터(4컬럼). 워터마크는 장식 소음이라 제거(2026-07).
// 카피는 실데이터에 맞춰 정직하게: "유럽 전용"이 아닌 글로벌 진출, 추천은 회원 전용.
const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "제품",
    links: [
      { label: "공고 검색", href: "/search" },
      { label: "맞춤 추천", href: "/recommend" },
      { label: "기업 디렉터리", href: "/companies" },
      { label: "이력서 코치", href: "/coach" },
    ],
  },
  {
    title: "탐색",
    links: [
      { label: "비자 스폰서 공고", href: "/search?visa=sponsors" },
      { label: "비자 가이드", href: "/visa" },
      { label: "원격 가능 공고", href: "/search?track=remote" },
      { label: "자주 묻는 질문", href: "/#faq" },
    ],
  },
  {
    title: "회사",
    links: [
      { label: "문의", href: "/contact" },
      { label: "회원가입", href: "/signup" },
      { label: "로그인", href: "/signin" },
      { label: "이용약관", href: "/terms" },
      { label: "개인정보처리방침", href: "/privacy" },
    ],
  },
];

const SOCIALS = [
  { label: "이메일", href: "mailto:worlddev61@gmail.com", Icon: MailMark },
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
                <BrandMark className="h-[18px] w-[18px]" />
              </span>
              <span className="text-lg font-bold tracking-tight text-foreground">
                Dev<span className="text-primary">Pass</span>
              </span>
            </Link>
            <p className="mt-3 max-w-xs text-body-sm leading-relaxed text-muted-foreground">
              비자 스폰서십이 명시된 해외 공고만 모아, 5축 점수로 한국 개발자의 해외 취업을
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
          <span>© {new Date().getFullYear()} DevPass. All rights reserved.</span>
          <span>Made for Korean developers heading abroad.</span>
        </div>
      </div>
    </footer>
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
