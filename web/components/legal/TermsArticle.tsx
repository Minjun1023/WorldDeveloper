import { TERMS, type TermsKey } from "@/lib/terms";

// 약관 문서 페이지 본문 — 회원가입 동의 모달(TermsAgreement)과 동일한 lib/terms.ts 를
// 단일 출처로 렌더한다(문구 이원화 방지).
export function TermsArticle({ termsKey }: { termsKey: TermsKey }) {
  const doc = TERMS[termsKey];
  return (
    <article className="mx-auto max-w-3xl">
      <h1 className="text-h1">{doc.title}</h1>
      <div className="mt-8 space-y-8">
        {doc.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-h3">{s.heading}</h2>
            <p className="mt-2 whitespace-pre-line text-body-sm leading-relaxed text-foreground/90">
              {s.body}
            </p>
          </section>
        ))}
      </div>
    </article>
  );
}
