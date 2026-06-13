import { Clock } from "lucide-react";
import Link from "next/link";

// 랜딩 하단 전환 유도(CTA). Readdy 목업: "프로필을 만들고 맞춤 추천을 받아보세요".
// 인디고→바이올렛 그라데이션 배너. 로그인 여부에 따라 1차 버튼 목적지를 바꾼다.
export function CtaSection({ loggedIn = false }: { loggedIn?: boolean }) {
  const primaryHref = loggedIn ? "/me/profile" : "/signup";
  const primaryLabel = loggedIn ? "내 프로필 작성하기" : "무료로 시작하기";

  return (
    <section
      className="bg-brand-gradient relative overflow-hidden rounded-3xl px-7 py-12 sm:px-12 sm:py-14"
    >
      {/* 은은한 격자 패턴 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      <div className="relative flex flex-col items-start justify-between gap-7 lg:flex-row lg:items-center">
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-caption font-semibold text-white">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            5분이면 완료
          </span>
          <h2 className="mt-4 text-h1 text-white">
            프로필을 만들고
            <br />
            맞춤 추천을 받아보세요.
          </h2>
          <p className="mt-3 text-body-sm text-white/85">
            기술 스택과 희망 지역만 알려주시면, 비자 가능 공고를 6차원 점수로 정렬해드려요.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
          <Link
            href={primaryHref}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white px-5 py-3 text-body-sm font-semibold text-primary transition-opacity hover:opacity-90"
          >
            {primaryLabel}
          </Link>
          <Link
            href="/recommend"
            className="inline-flex items-center justify-center rounded-xl border border-white/40 bg-white/10 px-5 py-3 text-body-sm font-medium text-white transition-colors hover:bg-white/20"
          >
            샘플 추천 보기
          </Link>
        </div>
      </div>
    </section>
  );
}
