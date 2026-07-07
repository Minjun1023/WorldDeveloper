import DOMPurify from "isomorphic-dompurify";

import { stripOrphanHeadings } from "@/lib/descHtml";

// 공고 원문(영문) 본문. 한국어 핵심 내용은 위의 AI 요약(JobSummary)이 담당한다.
// isomorphic-dompurify 로 서버 렌더 단계에서 살균 — 이전의 클라 동적 로드(dompurify)는
// 평문 폴백 → HTML 교체로 본문이 깜빡였다(FOUC). 이제 첫 HTML 부터 정화된 본문이 담긴다.
export function JobDescription({ original }: { original: string }) {
  const purified = DOMPurify.sanitize(original, { USE_PROFILES: { html: true } });
  // 보일러플레이트 제거로 남은 고아 제목(예: "개인정보 및 AI 가이드라인:")을 다듬는다.
  const safeHtml = stripOrphanHeadings(purified);

  return (
    <section className="space-y-2 rounded-lg border border-border bg-card p-5">
      <h2 className="text-h3">상세 설명</h2>
      <div className="job-desc text-body text-foreground/90" dangerouslySetInnerHTML={{ __html: safeHtml }} />
    </section>
  );
}
