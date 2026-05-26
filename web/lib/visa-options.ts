import type { DropdownOption } from "@/components/ui/dropdown";

// "전체"(null)는 Dropdown 이 자동 제공
export const VISA_OPTIONS: DropdownOption[] = [
  { value: "sponsors", label: "스폰서 가능" },
  { value: "unclear", label: "정보 없음" },
  { value: "no_sponsor", label: "스폰서 불가" },
];
