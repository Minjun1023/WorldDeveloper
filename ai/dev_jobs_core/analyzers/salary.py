"""연봉 통계 분석.

각 소스가 채워둔 salary_min/max/currency 를 기반으로 USD 로 정규화한 뒤
중앙값/평균/분포를 계산한다.
"""
from __future__ import annotations
from statistics import median, mean
from ..models import JobPosting

# 환율 (대략적, 실시간이 필요하면 외부 API 호출로 교체)
FX_TO_USD = {
    "USD": 1.0,
    "EUR": 1.08,
    "GBP": 1.27,
    "CAD": 0.73,
    "AUD": 0.66,
    "SGD": 0.74,
    "JPY": 0.0066,
    "KRW": 0.00072,
    "INR": 0.012,
    "CHF": 1.12,
    "SEK": 0.094,
    "PLN": 0.25,
}


def _to_usd_year(amount: float, currency: str, period: str) -> float | None:
    rate = FX_TO_USD.get((currency or "USD").upper())
    if not rate:
        return None
    usd = amount * rate
    p = (period or "YEAR").upper()
    if p == "YEAR":
        # Sanity: 일부 소스가 시간당 임금을 "YEAR" 로 잘못 보내는 케이스
        # (예: RemoteOK 의 Forge Global $21/h). $5,000 미만이면 시간당으로 재해석.
        if 0 < usd < 5000:
            return usd * 40 * 52
        return usd
    if p == "MONTH":
        return usd * 12
    if p == "HOUR":
        return usd * 40 * 52  # 가정: 주 40시간
    if p == "WEEK":
        return usd * 52
    if p == "DAY":
        return usd * 5 * 52
    return usd


def compute_salary_stats(jobs: list[JobPosting]) -> dict:
    """공고 리스트에서 연봉 통계 산출 (USD 연봉 기준)."""
    samples: list[tuple[float, float]] = []  # (min, max)
    for j in jobs:
        if j.salary_min is None and j.salary_max is None:
            continue
        lo = _to_usd_year(j.salary_min or j.salary_max or 0, j.salary_currency, j.salary_period)
        hi = _to_usd_year(j.salary_max or j.salary_min or 0, j.salary_currency, j.salary_period)
        if lo and hi and lo > 0 and hi > 0:
            samples.append((lo, hi))

    if not samples:
        return {
            "sample_size": 0,
            "note": "연봉 정보가 공개된 공고가 없습니다. 대부분의 회사가 description 에서만 언급합니다.",
        }

    mids = [(lo + hi) / 2 for lo, hi in samples]
    lows = [lo for lo, _ in samples]
    highs = [hi for _, hi in samples]

    return {
        "sample_size": len(samples),
        "currency": "USD (연봉 기준 정규화)",
        "median_mid": int(median(mids)),
        "mean_mid": int(mean(mids)),
        "median_low": int(median(lows)),
        "median_high": int(median(highs)),
        "min": int(min(lows)),
        "max": int(max(highs)),
        "total_jobs_analyzed": len(jobs),
        "jobs_with_salary": len(samples),
        "disclosure_rate": round(len(samples) / len(jobs), 2) if jobs else 0,
    }


import re

# 통화 기호/접두/통화어 → ISO 코드
_SAL_SYMBOL = {"$": "USD", "£": "GBP", "€": "EUR"}
_SAL_PREFIX = {"US$": "USD", "C$": "CAD", "A$": "AUD", "S$": "SGD"}
_SAL_CUR_WORD = re.compile(r"\b(USD|CAD|AUD|SGD|GBP|EUR|CHF)\b")

# 앵커: 연봉 명시 문구(오탐 방지). 금액 직전 ~80자 내에 있어야 인정.
# 핵심: 연봉어(salary/pay/compensation)를 range/band 또는 금액 맥락과 *바로* 붙여야 한다.
# 임의 단어를 사이에 허용하면 "compensation package ... a value range of $X"(지분 가치) 같은
# 비-연봉 금액이 새어 들어온다 → 인접 결합만 인정.
_SAL_ANCHOR = re.compile(
    r"(?:salary|pay|compensation)\s+(?:range|band)"                       # "salary range", "pay band"
    r"|(?:base|annual|target|total|gross|yearly|expected|on[- ]target|ote)\s+(?:salary|pay|compensation)"  # "annual salary"
    r"|(?:salary|compensation)\s*(?::|of\b|is\b)"                          # "Salary:", "salary of/is"
    r"|(?:range|band)\s+(?:of|for)\s+(?:the\s+)?(?:base\s+|annual\s+)?(?:salary|pay|compensation)"  # "range of base salary"
    r"|salary\s+for\s+this",
    re.I,
)

# 제외: 금액 직전에 이런 단서가 있으면 연봉이 아님(지분/펀딩/매출/법적/예산 등).
_SAL_EXCLUDE = re.compile(
    r"equity|option|grant|vest|valuation|raised|fundrais|funding|revenue"
    r"|\bARR\b|\bACV\b|contract\s+value|annual\s+contract|damages|stipend|reimburs|budget",
    re.I,
)

# 통화기호 + 숫자 + (k) + 구분자 + (통화기호) + 숫자 + (k)
_SAL_RANGE = re.compile(
    r"(?P<sym>US\$|C\$|A\$|S\$|[$£€])\s?"
    r"(?P<min>\d{1,3}(?:,\d{3})+|\d{1,7})(?:\.\d+)?\s?(?P<munit>[kK])?"
    r"\s*(?:-|–|—|to|~)\s*"
    r"(?:US\$|C\$|A\$|S\$|[$£€])?\s?"
    r"(?P<max>\d{1,3}(?:,\d{3})+|\d{1,7})(?:\.\d+)?\s?(?P<xunit>[kK])?"
)

_SAL_PERIODS = [
    (re.compile(r"per\s+hour|/\s?hour|hourly|/\s?hr\b|an\s+hour", re.I), "HOUR"),
    (re.compile(r"per\s+month|monthly|/\s?month|/\s?mo\b", re.I), "MONTH"),
]


def _sal_num(s: str, unit: str | None) -> float:
    v = float(s.replace(",", ""))
    if unit and unit.lower() == "k":
        v *= 1000
    return v


def extract_salary_from_description(text: str | None) -> dict | None:
    """본문에서 명시된 연봉 '범위'를 추출. 없으면 None.

    정직성: 'salary/pay/compensation range' 등 명시 문구가 금액 직전(~80자)에
    있어야만 인정(펀딩/매출/지분 $금액 오탐 방지). 범위(두 금액)만, 단일값 제외.
    반환 {min,max(원본통화 정수), currency(ISO), period(YEAR|MONTH|HOUR)}.
    """
    if not text:
        return None
    for m in _SAL_RANGE.finditer(text):
        pre = text[max(0, m.start() - 80): m.start()]
        if not _SAL_ANCHOR.search(pre):
            continue
        # 금액 직전 25자에 지분/펀딩/매출 등 비-연봉 단서가 있으면 스킵(앵커가 통과해도).
        if _SAL_EXCLUDE.search(text[max(0, m.start() - 25): m.start()]):
            continue
        lo = _sal_num(m.group("min"), m.group("munit"))
        hi = _sal_num(m.group("max"), m.group("xunit") or m.group("munit"))
        if hi < lo:
            lo, hi = hi, lo
        sym = m.group("sym").upper()
        cur = _SAL_PREFIX.get(sym) or _SAL_SYMBOL.get(sym[-1]) or "USD"
        cw = _SAL_CUR_WORD.search(text[m.end(): m.end() + 6].upper())
        if cw:
            cur = cw.group(1)
        period = "YEAR"
        window = text[max(0, m.start() - 30): m.end() + 30]
        for rx, p in _SAL_PERIODS:
            if rx.search(window):
                period = p
                break
        if period == "HOUR":
            if not (5 <= lo <= 2000 and 5 <= hi <= 2000):
                continue
        elif not (10_000 <= lo <= 10_000_000 and 10_000 <= hi <= 10_000_000):
            continue
        return {"min": int(lo), "max": int(hi), "currency": cur, "period": period}
    return None
