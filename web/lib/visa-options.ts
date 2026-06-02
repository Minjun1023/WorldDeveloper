import type { DropdownOption } from "@/components/ui/dropdown";

// "전체"(null)는 Dropdown 이 자동 제공.
// 비자 미확인("정보 없음")·스폰서 불가는 필터 가치가 낮아 제외. "원격근무"는 visa 가 아니라
// remote 필터로 동작(SearchBar onSelect 에서 remote=true 로 매핑).
export const VISA_OPTIONS: DropdownOption[] = [
  { value: "sponsors", label: "스폰서 가능" },
  { value: "remote", label: "원격근무" },
];
