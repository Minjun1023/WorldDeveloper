import Link from "next/link";

// 랜딩 하단 전환 유도(CTA). Figma: 솔리드 파랑 배너, 가운데 정렬, 2버튼.
export function CtaSection({ loggedIn = false }: { loggedIn?: boolean }) {
  const primaryHref = loggedIn ? "/me/profile" : "/signup";
  const primaryLabel = loggedIn ? "내 프로필 작성하기" : "무료로 시작하기";

  return (
    <section className="rounded-xl bg-primary px-7 py-14 text-center sm:px-12">
      <h2 className="text-h2 text-white sm:text-h1">
        지금 바로 시작하세요
      </h2>
      <p className="mx-auto mt-3 max-w-md text-body-sm leading-relaxed text-white/85">
        비자가 검증된 공고만 보고, 내 프로필에 딱 맞는 공고를 추천받으세요.
      </p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          href={primaryHref}
          className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-body-sm font-bold text-primary transition-opacity hover:opacity-90"
        >
          {primaryLabel}
        </Link>
        <Link
          href="/search"
          className="inline-flex items-center justify-center rounded-lg border border-white/50 bg-transparent px-6 py-3 text-body-sm font-medium text-white transition-colors hover:bg-white/10"
        >
          공고 둘러보기
        </Link>
      </div>
    </section>
  );
}
