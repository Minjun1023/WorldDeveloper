import { ArrowRight, Building2, FileText, MessagesSquare, ShieldCheck, Stamp } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";

export const metadata = {
  title: "커뮤니티 — WorldDeveloper",
  description: "먼저 간 개발자들의 해외취업 비자·면접·정착 경험을 나누는 공간(준비 중).",
};

// 커뮤니티는 '준비 중(베타)' 상태. 정직성 원칙상 가짜 후기/글은 넣지 않는다 — 실제 글·현직 인증·작성
// 기능이 준비되면 채운다. 그동안은 우리가 가진 진짜 콘텐츠(비자 가이드·회사 정보·방법론)로 연결한다.
const PLANNED = ["비자·이민", "면접 후기", "연봉·협상", "이주·정착", "회사 후기", "Q&A"];

const HELPERS = [
  {
    href: "/visa",
    Icon: Stamp,
    title: "비자 가이드",
    desc: "국가별 비자·스폰서십 정보를 공식 출처 기준으로 정리했어요.",
  },
  {
    href: "/companies",
    Icon: Building2,
    title: "회사 정보",
    desc: "명부 검증 회사와 직원 규모·업종 등 회사별 사실 정보를 봐요.",
  },
  {
    href: "/coach",
    Icon: FileText,
    title: "이력서 코치",
    desc: "이 공고에 맞춰 이력서 키워드·강조 포인트를 상담받아요.",
  },
];

export default function CommunityPage() {
  return (
    <div className="space-y-10">
      {/* 헤더 — 라운지 이름은 고유 브랜드라 유지(중복 overline 제거, 제목 축소) */}
      <section>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-h1">해외취업 라운지</h1>
          <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-caption font-semibold text-primary">
            BETA
          </span>
        </div>
        <p className="mt-1.5 max-w-xl text-body-sm text-muted-foreground">
          먼저 간 개발자들의 비자·면접·연봉·정착 경험을 나누는 공간이에요. 추정 없이, 겪은 사람의
          이야기로.
        </p>
      </section>

      {/* 정직한 준비중 안내 */}
      <Card className="flex items-start gap-3 rounded-xl border-primary/20 bg-primary/5 p-5">
        <MessagesSquare className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="space-y-1.5">
          <h2 className="text-h3">곧 열려요</h2>
          <p className="text-body-sm text-muted-foreground">
            가짜 후기 없이, <strong className="font-semibold text-foreground">현직 인증</strong>(회사
            이메일 확인)과 <strong className="font-semibold text-foreground">출처 표기</strong>를 갖춘
            검증된 경험만 모으려고 준비 중이에요. 빈 게시판으로 먼저 열기보다, 신뢰할 수 있는 글이
            쌓일 준비가 되면 공개할게요.
          </p>
          <p className="flex items-center gap-1.5 pt-1 text-caption text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-verified" aria-hidden="true" />
            WorldDeveloper의 원칙: 검증되지 않은 정보는 추정해서 보여주지 않습니다.
          </p>
        </div>
      </Card>

      {/* 다룰 주제 미리보기 */}
      <section className="space-y-3">
        <h2 className="text-h3">이런 이야기를 나눠요</h2>
        <div className="flex flex-wrap gap-2">
          {PLANNED.map((t) => (
            <span
              key={t}
              className="rounded-full border border-border bg-surface-2 px-3.5 py-1.5 text-body-sm text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* 그동안 도움이 되는 실제 콘텐츠 */}
      <section className="space-y-4">
        <div>
          <h2 className="text-h3">그동안 도움이 되는 것</h2>
          <p className="mt-1 text-body-sm text-muted-foreground">
            커뮤니티가 열리기 전에도, 이미 검증된 정보로 준비할 수 있어요.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {HELPERS.map(({ href, Icon, title, desc }) => (
            <Link key={href} href={href} className="group block h-full">
              <Card className="flex h-full flex-col rounded-xl p-5 transition-all hover:border-primary/40 hover:shadow-md">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2 text-foreground">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mt-3 font-semibold transition-colors group-hover:text-primary">
                  {title}
                </h3>
                <p className="mt-1 flex-1 text-body-sm text-muted-foreground">{desc}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-body-sm font-medium text-primary">
                  바로 가기
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
