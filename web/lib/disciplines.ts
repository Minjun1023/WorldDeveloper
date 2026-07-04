import type { DropdownOption } from "@/components/ui/dropdown";

export const DISCIPLINES: DropdownOption[] = [
  { value: "backend", label: "백엔드" },
  { value: "frontend", label: "프론트엔드" },
  { value: "fullstack", label: "풀스택" },
  { value: "mobile", label: "모바일" },
  { value: "data-ml", label: "데이터·ML" },
  { value: "devops", label: "DevOps·인프라" },
  { value: "qa", label: "QA·테스트" },
  { value: "embedded", label: "임베디드·시스템" },
  { value: "game", label: "게임" },
  // '기타(분류 외)' = 위 어느 직무에도 매칭되지 않는 공고(백엔드에서 NOT 처리) → 100% 커버.
  { value: "other", label: "기타 (분류 외)" },
];
