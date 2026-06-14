import { Check } from "lucide-react";
import type { JobVisa } from "@/lib/types";

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

export function VisaEvidence({ visa }: { visa?: JobVisa }) {
  const evidence = (visa?.evidence ?? [])
    .map(cleanEvidence)
    .filter((e) => /[\p{L}\p{N}]/u.test(e)); // 태그만 있던 항목은 빈 값이 되어 제거
  if (evidence.length === 0 && !visa?.register_verified) return null;
  return (
    <div className="rounded-xl border border-success/30 bg-success/5 p-3">
      {visa?.register_verified && (
        <span className="mb-2 inline-block rounded-full bg-success/15 px-2 py-0.5 text-caption font-semibold text-success">명부검증</span>
      )}
      <ul className="space-y-1.5">
        {evidence.map((e, i) => (
          <li key={i} className="flex items-start gap-1.5 text-body-sm text-foreground">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
            <span>{e}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
