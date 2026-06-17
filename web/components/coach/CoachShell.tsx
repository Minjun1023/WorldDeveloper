"use client";

import { Coins, Info, LayoutGrid, Lock, MessageSquare, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { CoachChat } from "@/components/coach/CoachChat";
import { cn } from "@/lib/utils";

// 이력서 코치 = 직행 "커리어AI" 식 앱셸: 좌측 사이드바(도구·소개·크레딧) + 메인이 화면을 채움.
// 전역 navbar 는 두지 않음(/coach 는 (main) 그룹 밖) — 브랜드를 누르면 홈으로 돌아간다.
type View = "tools" | "about" | "credits";

const NAV: { key: View; label: string; icon: typeof LayoutGrid }[] = [
  { key: "tools", label: "도구", icon: LayoutGrid },
  { key: "about", label: "소개", icon: Info },
  { key: "credits", label: "크레딧", icon: Coins },
];

export function CoachShell({ loggedIn }: { loggedIn: boolean }) {
  const [view, setView] = useState<View>("tools");

  // 전역 navbar(SiteNav) 높이 ≈ 61px — 사이드바를 그 아래에 고정하고 영역을 그만큼 줄인다.
  // navbar 와 같은 max-w-container/px-4 컨테이너에 맞춰 좌측 경계를 정렬한다(풀블리드 시 선이 어긋나 보임).
  return (
    <div className="mx-auto flex min-h-[calc(100vh-61px)] w-full max-w-container flex-col px-4 lg:flex-row">
      {/* 사이드바 */}
      <aside className="flex shrink-0 flex-col border-b border-border bg-surface lg:sticky lg:top-[61px] lg:min-h-[calc(100vh-61px)] lg:w-64 lg:self-start lg:border-b-0 lg:border-r">
        {/* 내비 (모바일=가로, 데스크톱=세로) — 항목 아이콘을 전역 navbar 로고 시작점에 정렬(-ml-3) */}
        <nav className="-ml-3 flex gap-1 overflow-x-auto py-3 lg:mt-3 lg:flex-col lg:overflow-visible lg:py-0">
          {NAV.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              aria-current={view === key}
              className={cn(
                "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-body-sm font-medium transition-colors",
                view === key
                  ? "bg-surface-2 text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>

        {/* 로그아웃 시 로그인 유도 카드 (Figma) — 데스크톱만(모바일은 메인 잠금 화면이 안내) */}
        {!loggedIn && (
          <div className="mx-3 mt-4 hidden rounded-xl bg-surface-2 p-4 lg:block">
            <p className="text-body-sm font-medium leading-snug text-foreground">
              로그인하고
              <br />
              대화 기록을 확인해보세요!
            </p>
            <Link
              href="/signin?callbackUrl=/coach"
              className="mt-3 inline-flex rounded-lg bg-primary px-4 py-2 text-caption font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              로그인
            </Link>
          </div>
        )}

        {/* 하단 피드백 (데스크톱만) — 메뉴와 같은 좌측 정렬 */}
        <div className="-ml-3 hidden pb-3 pr-3 lg:mt-auto lg:block">
          <Link
            href="/contact"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-body-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            피드백
          </Link>
        </div>
      </aside>

      {/* 메인 — 남은 영역을 채우고 히어로를 세로 가운데로 */}
      <main className="flex flex-1 flex-col justify-center py-8 lg:py-12 lg:pl-8">
        {view === "tools" && (loggedIn ? <CoachChat /> : <CoachLocked />)}
        {view === "about" && <AboutView onStart={() => setView("tools")} />}
        {view === "credits" && <CreditsView onStart={() => setView("tools")} />}
      </main>
    </div>
  );
}

// 로그아웃 상태의 도구 화면 — 히어로는 보여주되 사용은 로그인 후.
function CoachLocked() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-7 text-center">
      <div className="flex flex-col items-center">
        <p className="text-body text-muted-foreground">이 공고, 내 이력서로 통할까?</p>
        <h1 className="mt-2 text-[clamp(1.6rem,3.5vw,2.4rem)] font-bold leading-tight tracking-tight text-foreground">
          막연한 불안 대신, 바로 물어보세요
        </h1>
        <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3.5 py-1.5 text-caption text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          선택한 공고의 요건에 맞춰 이력서를 봐드려요
        </span>
      </div>

      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <span className="bg-brand-gradient mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-sm">
          <Lock className="h-6 w-6" aria-hidden="true" />
        </span>
        <p className="text-body font-medium text-foreground">로그인하면 이력서 코치를 이용할 수 있어요</p>
        <p className="mt-1.5 text-body-sm text-muted-foreground">대화 기록도 저장돼 다음에 이어볼 수 있어요.</p>
        <Link
          href="/signin?callbackUrl=/coach"
          className="bg-brand-gradient mt-5 inline-flex rounded-xl px-6 py-2.5 text-body-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          로그인하고 시작하기
        </Link>
      </div>
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
