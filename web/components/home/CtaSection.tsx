import Link from "next/link";

// 랜딩 하단 전환 유도(CTA). 사이트가 무료·회원가입 불필요라 가입이 아닌 "검색" 유도.
export function CtaSection() {
  return (
    <section className="hero-gradient rounded-xl border border-border px-6 py-12 text-center">
      <h2 className="text-h2">지금 비자 스폰서 공고를 찾아보세요</h2>
      <p className="mx-auto mt-2 max-w-xl text-body-sm text-muted-foreground">
        무료 · 회원가입 불필요 · 정부 명부로 검증된 스폰서
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/search"
          className="rounded-md bg-primary px-5 py-2.5 text-body-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          공고 검색하기
        </Link>
        <Link
          href="/recommend"
          className="rounded-md border border-border bg-surface px-5 py-2.5 text-body-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          AI 추천 받기
        </Link>
      </div>
    </section>
  );
}
