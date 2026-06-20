"use client";

import { Coins, Info, Sparkles, Wrench } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { CoachChat } from "@/components/coach/CoachChat";
import { cn } from "@/lib/utils";

// 이력서 코치 = 직행 "커리어AI" 식 앱셸: 좌측 사이드바(브랜드 + 도구·소개·크레딧) + 메인 히어로.
// 전역 navbar(SiteNav)는 페이지에서 얹고, 여기는 그 아래를 채운다.
type View = "tools" | "about" | "credits";

const NAV: { key: View; label: string; icon: typeof Wrench }[] = [
  { key: "tools", label: "도구", icon: Wrench },
  { key: "about", label: "소개", icon: Info },
  { key: "credits", label: "크레딧", icon: Sparkles },
];

export function CoachShell({ loggedIn }: { loggedIn: boolean }) {
  const [view, setView] = useState<View>("tools");

  // 전역 navbar(SiteNav) 높이 ≈ 61px — 사이드바를 그 아래에 고정하고 영역을 그만큼 줄인다.
  return (
    <div className="flex min-h-[calc(100vh-61px)] w-full flex-col lg:flex-row">
      {/* 사이드바 — 화면 왼쪽 가장자리까지 채움(풀블리드). 다크모드에서 좌측에 본문 배경이
          비쳐 깨져 보이던 문제를 해소하고, 메뉴를 왼쪽 가장자리로 이동. */}
      <aside className="flex shrink-0 flex-col border-b border-border bg-surface px-4 lg:sticky lg:top-[61px] lg:min-h-[calc(100vh-61px)] lg:w-64 lg:self-start lg:border-b-0 lg:border-r lg:py-4">
        {/* 내비 (모바일=가로, 데스크톱=세로) */}
        <nav className="flex gap-1 overflow-x-auto py-3 lg:flex-col lg:overflow-visible lg:py-0">
          {NAV.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              aria-current={view === key}
              className={cn(
                "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-body-sm font-medium transition-colors",
                view === key
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>

        {/* 로그아웃 시 로그인 유도 카드 (대화 기록 저장 안내) — 데스크톱만 */}
        {!loggedIn && (
          <div className="mt-4 hidden rounded-xl bg-surface-2 p-4 lg:block">
            <p className="text-body-sm font-semibold text-foreground">대화 기록을 저장하려면</p>
            <p className="mt-1 text-caption leading-snug text-muted-foreground">로그인하면 대화를 90일간 보관해 드려요.</p>
            <Link
              href="/signin?callbackUrl=/coach"
              className="mt-3 block rounded-lg bg-primary px-4 py-2 text-center text-caption font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              로그인
            </Link>
          </div>
        )}

        {/* 하단: 의견·문의 (데스크톱만) */}
        <div className="hidden pb-4 lg:mt-auto lg:block">
          <Link
            href="/contact"
            className="text-caption text-muted-foreground transition-colors hover:text-foreground"
          >
            의견·문의 보내기
          </Link>
        </div>
      </aside>

      {/* 메인 — 히어로(세로 가운데) */}
      <main className="flex flex-1 flex-col px-4 lg:px-8">
        <div className="flex flex-1 flex-col justify-center py-6 lg:py-10">
          {view === "tools" && <CoachChat loggedIn={loggedIn} />}
          {view === "about" && <AboutView onStart={() => setView("tools")} />}
          {view === "credits" && <CreditsView onStart={() => setView("tools")} />}
        </div>
      </main>
    </div>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-body-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1.5 text-body-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function AboutView({ onStart }: { onStart: () => void }) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div>
        <h1 className="text-h2 text-foreground">이력서 코치 소개</h1>
        <p className="mt-2 text-body-sm leading-relaxed text-muted-foreground">
          선택한 공고 하나에 집중해, 그 공고의 채용 요건·회사 정보와 직접 붙여넣은 이력서를 바탕으로 1:1로 조언하는 AI 코치예요.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <InfoCard
          title="공고 기반 조언"
          body="여러 공고를 한꺼번에 보는 검색이 아니라, 고른 공고 한 건에 맞춰 강조할 키워드와 보완할 점을 짚어줘요."
        />
        <InfoCard
          title="개인정보 보호"
          body="이력서는 저장하지 않아요. 대화 내용만 90일간 보관돼 다음에 이어볼 수 있어요."
        />
        <InfoCard
          title="무엇을 물어볼 수 있나요"
          body="공고 맞춤 키워드, 경력 요약 다듬기, 기술 스택 구성, 프로젝트 섹션 피드백, 면접 예상 질문 등."
        />
        <InfoCard
          title="시작하기"
          body="도구 탭에서 상담할 공고를 고르고 이력서를 붙여넣은 뒤 바로 질문하면 돼요."
        />
      </div>

      <button
        type="button"
        onClick={onStart}
        className="bg-brand-gradient inline-flex rounded-xl px-6 py-2.5 text-body-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        도구로 가기
      </button>
    </div>
  );
}

function CreditsView({ onStart }: { onStart: () => void }) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <h1 className="text-h2 text-foreground">크레딧</h1>

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="bg-brand-gradient flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm">
            <Coins className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-body font-semibold text-foreground">베타 기간 무료</p>
            <p className="text-body-sm text-muted-foreground">크레딧 차감 없이 이용할 수 있어요.</p>
          </div>
        </div>
        <p className="mt-4 text-body-sm leading-relaxed text-muted-foreground">
          이력서 코치는 현재 베타로 무료 제공돼요. 별도의 크레딧이나 결제가 필요하지 않습니다. 원활한 운영을 위해
          짧은 시간에 너무 많은 요청을 보내면 잠시 제한될 수 있어요.
        </p>
      </div>

      <button
        type="button"
        onClick={onStart}
        className="bg-brand-gradient inline-flex rounded-xl px-6 py-2.5 text-body-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        상담 시작하기
      </button>
    </div>
  );
}
