import type { JobSalary } from "@/lib/types";

const SYMBOL: Record<string, string> = { USD: "$", GBP: "£", EUR: "€", CAD: "C$", AUD: "A$", SGD: "S$", CHF: "CHF " };

// 원본 통화 우선 표시(£65,600→£66k), 원본 없으면 USD 환산값 폴백. 연봉 k반올림, 시급/월급 접미사.
export function formatSalary(s?: JobSalary | null): string | null {
  if (!s) return null;
  if (s.currency && (s.min || s.max)) {
    const sym = SYMBOL[s.currency] ?? `${s.currency} `;
    const period = (s.period ?? "YEAR").toUpperCase();
    const hourly = period === "HOUR";
    const unit = (n: number) => (hourly ? `${sym}${n}` : `${sym}${Math.round(n / 1000)}k`);
    const suffix = hourly ? "/시간" : period === "MONTH" ? "/월" : "";
    const body = s.min && s.max ? `${unit(s.min)}–${unit(s.max)}` : unit((s.min ?? s.max)!);
    return `${body}${suffix}`;
  }
  const { min_usd, max_usd } = s;
  if (!min_usd && !max_usd) return null;
  const k = (n: number) => `$${Math.round(n / 1000)}k`;
  return min_usd && max_usd ? `${k(min_usd)}–${k(max_usd)}` : k((min_usd ?? max_usd)!);
}
