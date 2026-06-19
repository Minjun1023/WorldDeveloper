import { ShieldCheck } from "lucide-react";
import type { JobVisa } from "@/lib/types";
import { cn } from "@/lib/utils";

// 표시단에서 자주 나오는 HTML 엔티티만 디코드(SSR이라 DOM 미사용). 그 외는 원형 유지.
const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  mdash: "—", ndash: "–", hellip: "…",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m: string, body: string) => {
    if (body.startsWith("#")) {
      const code =
        body[1] === "x" || body[1] === "X"
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? m;
  });
}

// 비자 evidence는 평문 계약이지만, PR #148(본문 평문 분석) 이전에 적재된 일부 공고는 저장값에
// 원시 HTML(<p>, <strong ...>, &nbsp; 등)이 섞여 있다. 다음 ETL 재수집 때 데이터가 정리되지만,
// 그 전까지 표시 직전에 방어적으로 태그/엔티티/부스러기를 제거한다. 이미 깨끗한 값엔 무해하다.
export function cleanEvidence(raw: string): string {
  return decodeEntities(raw.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .replace(/^\.\.\.\s*>\s*/, "... ") // 태그 중간에서 잘려 남은 선두 '>' 부스러기
    .trim();
}

// 비자 근거를 큰 박스 대신 제목 영역의 칩 아래 '한 줄'로 압축한다.
// register_verified(정부 명부 대조)면 골드 강조, 그 외 근거는 중립 톤(과장 금지).
export function VisaEvidence({ visa }: { visa?: JobVisa }) {
  const evidence = (visa?.evidence ?? [])
    .map(cleanEvidence)
    .filter((e) => /[\p{L}\p{N}]/u.test(e)); // 태그만 있던 항목은 빈 값이 되어 제거
  const verified = !!visa?.register_verified;
  if (evidence.length === 0 && !verified) return null;
  return (
    // Figma 검증 박스: 인디고 박스 + 방패 + 근거 문장 + 우측 '정부 명부 검증' 배지.
    <div
      className={cn(
        "flex items-start justify-between gap-3 rounded-xl border p-3.5 text-body-sm",
        verified
          ? "border-[#c7d2fe] bg-[#eef2ff] dark:border-[#4338ca]/40 dark:bg-[#1e1b4b]/30"
          : "border-border bg-surface-2",
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <ShieldCheck
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0",
            verified ? "text-[#4338ca] dark:text-[#a5b4fc]" : "text-muted-foreground",
          )}
          aria-hidden="true"
        />
        <p className={cn(verified ? "font-semibold text-[#4338ca] dark:text-[#a5b4fc]" : "text-foreground/80")}>
          {evidence.length > 0 ? evidence.join(" · ") : "정부 명부에서 스폰서 이력이 확인됐어요."}
        </p>
      </div>
      {verified && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#c7d2fe] px-2 py-0.5 text-caption font-semibold text-[#4338ca] dark:border-[#4338ca]/40 dark:text-[#a5b4fc]">
          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
          정부 명부 검증
        </span>
      )}
    </div>
  );
}
