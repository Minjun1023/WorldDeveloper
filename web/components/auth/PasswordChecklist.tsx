import type { PasswordChecks } from "@/lib/password";

const ITEMS: { key: keyof PasswordChecks; label: string }[] = [
  { key: "length", label: "10자 이상" },
  { key: "upper", label: "대문자 포함" },
  { key: "lower", label: "소문자 포함" },
  { key: "digit", label: "숫자 포함" },
];

export function PasswordChecklist({ checks }: { checks: PasswordChecks }) {
  return (
    <ul aria-label="비밀번호 요건" className="space-y-1 text-caption">
      {ITEMS.map(({ key, label }) => (
        <li
          key={key}
          className={checks[key] ? "text-success" : "text-muted-foreground"}
        >
          {checks[key] ? "✓" : "○"} {label}
        </li>
      ))}
    </ul>
  );
}
