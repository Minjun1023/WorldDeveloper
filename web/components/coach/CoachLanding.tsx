import { ArrowDown, MessagesSquare, Pencil, Target } from "lucide-react";

// 코치 진입(비-대화) 랜딩 — 가치 제안 + before/after 예시 + 기능/단계 안내.
// 미배포라 '코칭한 이력서 N건·통과율 N배' 같은 측정 통계는 넣지 않는다(만들어낸 수치 금지).
// 실제 시작(입력·첨부)은 아래 입력창에서 하므로 히어로에 별도 CTA 버튼은 두지 않는다.

const FEATURES = [
  { icon: Target, title: "공고 키워드 매칭", desc: "공고에서 핵심 역량을 뽑아 내 이력서에 빠진 키워드를 짚어줘요." },
  { icon: Pencil, title: "문장 다시쓰기", desc: "두루뭉술한 문장을 성과·숫자 중심으로 바꿔줘요." },
  { icon: MessagesSquare, title: "예상 면접 질문", desc: "이력서 기반으로 나올 법한 질문을 미리 뽑아줘요." },
];

const STEPS = [
  { n: "01", title: "이력서 붙여넣기", desc: "파일 또는 텍스트로" },
  { n: "02", title: "공고 선택 (선택)", desc: "붙이면 맞춤 분석" },
  { n: "03", title: "문장별 피드백", desc: "바로 고쳐쓰기" },
];

export function CoachLanding() {
  return (
    <div className="w-full space-y-10">
      {/* 히어로 + 실시간 코칭 예시 */}
      <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
        <div>
          <h1 className="text-[clamp(1.6rem,3.6vw,2.4rem)] font-bold leading-tight tracking-tight text-foreground">
            약한 이력서 문장을,
            <br />
            합격하는 문장으로
          </h1>
          <p className="mt-3 max-w-md text-body text-muted-foreground">
            공고를 붙이면 그 회사가 원하는 키워드로, 문장 하나하나를 성과와 숫자 중심으로 다시 써드려요.
          </p>
        </div>

        {/* before → after 예시 (측정 통계 아님, 답변 예시) */}
        <div className="rounded-2xl border border-border bg-surface-2 p-5">
          <p className="text-caption font-medium text-muted-foreground">실시간 코칭 예시</p>
          <div className="mt-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3.5">
            <p className="text-caption font-semibold text-destructive">현재</p>
            <p className="mt-1 text-body-sm text-foreground">백엔드 API를 담당했습니다</p>
          </div>
          <div className="flex justify-center py-1.5 text-muted-foreground" aria-hidden="true">
            <ArrowDown className="h-4 w-4" />
          </div>
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5">
            <p className="text-caption font-semibold text-primary">제안</p>
            <p className="mt-1 text-body-sm text-foreground">
              REST API 12종을 설계해 응답시간을 820ms→210ms로 단축했습니다
            </p>
          </div>
          <p className="mt-2 text-caption text-muted-foreground">* 실제 답변 형태를 보여주는 예시예요.</p>
        </div>
      </div>

      {/* 기능 카드 */}
      <section>
        <h2 className="text-body-sm font-medium text-muted-foreground">이력서 코치가 하는 일</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-surface p-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <f.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-3 text-body font-semibold text-foreground">{f.title}</h3>
              <p className="mt-1 text-body-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3단계 */}
      <section className="rounded-2xl bg-surface-2 p-6">
        <h2 className="text-body-sm font-medium text-muted-foreground">3단계면 끝나요</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n}>
              <p className="text-body font-bold text-primary">{s.n}</p>
              <p className="mt-1 text-body font-semibold text-foreground">{s.title}</p>
              <p className="text-body-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 소개 */}
      <section>
        <h2 className="text-body-sm font-medium text-muted-foreground">이력서 코치 소개</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {[
            ["공고 기반 조언", "여러 공고를 한꺼번에 보는 검색이 아니라, 고른 공고 한 건에 맞춰 강조할 키워드와 보완할 점을 짚어줘요."],
            ["개인정보 보호", "이력서는 저장하지 않아요. 대화 내용만 90일간 보관돼 다음에 이어볼 수 있어요."],
            ["무엇을 물어볼 수 있나요", "공고 맞춤 키워드, 경력 요약 다듬기, 기술 스택 구성, 프로젝트 섹션 피드백, 면접 예상 질문 등."],
            ["크레딧 — 베타 무료", "지금은 베타라 크레딧 차감 없이 무료로 쓸 수 있어요. 짧은 시간에 너무 많은 요청을 보내면 잠시 제한될 수 있어요."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-2xl border border-border bg-surface p-5">
              <p className="text-body-sm font-semibold text-foreground">{title}</p>
              <p className="mt-1.5 text-body-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
