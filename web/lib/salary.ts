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

// USD→KRW 환산 환율(근사 상수). 환율은 몇 % 단위로 움직이고 표시는 '약 N억'이라 충분.
// 갱신: 이 값만 바꾸면 전 화면 반영. (후속으로 무료 일일 API 연동 가능 — 유료 불필요.)
export const USD_TO_KRW = 1380;

// 원화 환산용 USD 연봉 범위. min_usd/max_usd 우선, 없으면 USD 원본(min/max). 연봉(YEAR)만 환산.
function usdYearRange(s: JobSalary): [number, number] | null {
  if ((s.period ?? "YEAR").toUpperCase() !== "YEAR") return null; // 시급/월급은 원화 환산 생략
  let lo: number | undefined;
  let hi: number | undefined;
  if (s.min_usd != null || s.max_usd != null) {
    lo = s.min_usd ?? undefined;
    hi = s.max_usd ?? undefined;
  } else if (s.currency === "USD") {
    lo = s.min;
    hi = s.max;
  } else {
    return null; // 비-USD 원본 + USD 환산값 없음 → 환산 불가
  }
  const a = lo ?? hi;
  const b = hi ?? lo;
  if (a == null || b == null) return null;
  return [a, b];
}

// USD 금액 → 원화 단위 문자열(억/만). 1억 이상은 억(10억 미만 1자리), 미만은 만원.
function krwUnit(usd: number): string {
  const won = usd * USD_TO_KRW;
  const eok = won / 1e8;
  if (eok >= 1) return `${eok >= 10 ? Math.round(eok) : Math.round(eok * 10) / 10}억`;
  const man = Math.round(won / 1e4 / 100) * 100; // 100만 단위 반올림
  return `${man.toLocaleString()}만`;
}

// 연봉을 원화 근사 문자열로. 예: $130k–$160k → "약 1.8억~2.2억 원". 환산 불가 시 null.
export function formatSalaryKrw(s?: JobSalary | null): string | null {
  if (!s) return null;
  const r = usdYearRange(s);
  if (!r) return null;
  const [lo, hi] = r;
  const body = lo !== hi ? `${krwUnit(lo)}~${krwUnit(hi)}` : krwUnit(lo);
  return `약 ${body} 원`;
}
