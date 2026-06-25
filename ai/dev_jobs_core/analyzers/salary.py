"""연봉 통계 분석.

각 소스가 채워둔 salary_min/max/currency 를 기반으로 USD 로 정규화한 뒤
중앙값/평균/분포를 계산한다.
"""
from __future__ import annotations

from statistics import mean, median

from ..models import JobPosting

# 환율 (대략적, 실시간이 필요하면 외부 API 호출로 교체)
FX_TO_USD = {
    "USD": 1.0,
    "EUR": 1.08,
    "GBP": 1.27,
    "CAD": 0.73,
    "AUD": 0.66,
    "SGD": 0.74,
    "NZD": 0.60,
    "HKD": 0.128,
    "JPY": 0.0066,
    "KRW": 0.00072,
    "INR": 0.012,
    "CHF": 1.12,
    "SEK": 0.094,
    "NOK": 0.092,
    "DKK": 0.145,
    "PLN": 0.25,
    "CZK": 0.043,
    "HUF": 0.0028,
    "RON": 0.22,
    "BRL": 0.18,
    "MXN": 0.054,
    "ZAR": 0.054,
    "ILS": 0.27,
    "AED": 0.27,
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
_SAL_CUR_WORD = re.compile(
    r"\b(USD|CAD|AUD|SGD|NZD|HKD|GBP|EUR|CHF|SEK|NOK|DKK|PLN|CZK|HUF|RON|"
    r"JPY|KRW|INR|BRL|MXN|ZAR|ILS|AED)\b")

# 앵커: 연봉 명시 문구(오탐 방지). 금액 직전 ~80자 내에 있어야 인정.
# 핵심: 연봉어(salary/pay/compensation)를 range/band 또는 금액 맥락과 *바로* 붙여야 한다.
# 임의 단어를 사이에 허용하면 "compensation package ... a value range of $X"(지분 가치) 같은
# 비-연봉 금액이 새어 들어온다 → 인접 결합만 인정.
_SAL_ANCHOR = re.compile(
    r"(?:salary|pay|compensation)\s+(?:[A-Za-z]+\s+){0,2}(?:range|band)"   # "salary range", "Salary Hiring Range", "pay band"
    r"|(?:base|annual|target|total|gross|yearly|expected|on[- ]target|ote)\s+(?:salary|pay|compensation)"  # "annual salary"
    r"|(?:salary|compensation)\s*(?::|of\b|is\b)"                          # "Salary:", "salary of/is"
    r"|(?:salary|compensation|base\s+pay)\s+(?=US\$|[$£€]|\d{1,3},\d{3})"  # "Compensation $X", "Salary 153,000"
    r"|(?:range|band)\s+(?:of|for)\s+(?:the\s+)?(?:base\s+|annual\s+)?(?:salary|pay|compensation)"  # "range of base salary"
    r"|salary\s+for\s+this"
    r"|hourly\s+(?:rate|pay)|pay\s+rate",                                  # "Hourly Rate", "pay rate"
    re.I,
)

# 제외: 금액 직전에 이런 단서가 있으면 연봉이 아님(지분/펀딩/매출/법적/예산 등).
_SAL_EXCLUDE = re.compile(
    r"equity|option|grant|vest|valuation|raised|fundrais|funding|revenue"
    r"|\bARR\b|\bACV\b|contract\s+value|annual\s+contract|damages|stipend|reimburs|budget",
    re.I,
)

# (통화기호) + 숫자 + (k) + 구분자 + (통화기호) + 숫자 + (k)
# 첫 통화기호는 선택 — "153,000 - 213,000"(Affirm)·"230,000 - $270,000"(Harvey) 처럼 기호 없이
# 적는 소스가 많다. 단, 기호 없는 매칭은 아래 코드에서 엄격 검증(salary-shaped + 명사 가드)한다.
# 구분자: 대시/to/~ (양쪽 통화기호 선택) OR 공백(단, 둘째 금액 통화기호 필수 — 오탐 방지).
_SAL_RANGE = re.compile(
    r"(?P<sym>US\$|C\$|A\$|S\$|[$£€])?\s?"
    r"(?P<min>\d{1,3}(?:,\d{3})+|\d{1,7})(?P<mdec>\.\d+)?\s?(?P<munit>[kK])?"
    r"(?:\s*(?:-|–|—|to|~)\s*|\s+(?=US\$|C\$|A\$|S\$|[$£€]))"
    r"(?P<sym2>US\$|C\$|A\$|S\$|[$£€])?\s?"
    r"(?P<max>\d{1,3}(?:,\d{3})+|\d{1,7})(?P<xdec>\.\d+)?\s?(?P<xunit>[kK])?"
)

# 통화기호 없는 범위 직후에 이런 명사가 오면 금액(연봉)이 아니다(인원수/기간 등 오탐 방지).
_SAL_COUNT_NOUN = re.compile(
    r"\s*(?:employees?|customers?|users?|people|members?|companies|clients?|"
    r"organizations?|developers?|engineers?|seats?|hours?|years?|months?|days?|reviews?)",
    re.I,
)


def _is_salary_shaped(num: str) -> bool:
    """통화기호 없는 금액이 연봉 규모로 보이나 — 콤마 구분(153,000) 또는 5자리+(153000)."""
    return "," in num or len(num) >= 5

_SAL_PERIODS = [
    (re.compile(r"per\s+hour|/\s?hour|hourly|/\s?hr\b|an\s+hour", re.I), "HOUR"),
    (re.compile(r"per\s+month|monthly|/\s?month|/\s?mo\b", re.I), "MONTH"),
]


def _sal_num(s: str, dec: str | None, unit: str | None) -> float:
    v = float(s.replace(",", "") + (dec or ""))
    if unit and unit.lower() == "k":
        v *= 1000
    return v


# 일본어 연봉: 年収(연)/月給(월) 앵커 + 범위. HRMOS 외 소스(lever/greenhouse 등)의
# 일본어 JD 가 본문에만 円/万円 으로 적는 경우를 잡는다. 보수적(앵커 인접 + 범위 + 정상범위).
_JP_ANCHOR = re.compile(r"年収|月給|想定年収|給与")
# "600万円〜1,000万円" / "600万〜1000万円" (만엔 = ×10,000). 둘째 항은 万円 필수.
_JP_MAN_RANGE = re.compile(
    r"(\d{1,4}(?:,\d{3})?)\s*万?円?\s*[〜~\-–ー]\s*(\d{1,4}(?:,\d{3})?)\s*万円")
# "584,000円〜917,000円" (만 없이 円). 콤마 또는 5자리+ 숫자.
_JP_YEN_RANGE = re.compile(
    r"(\d{1,3}(?:,\d{3})+|\d{5,9})\s*円\s*[〜~\-–ー]\s*(\d{1,3}(?:,\d{3})+|\d{5,9})\s*円")


def _extract_jp_salary(text: str) -> dict | None:
    """일본어 본문 연봉 추출(円/万円). 年収/月給 앵커가 금액 앞 ~25자에 있어야 인정."""
    for m in _JP_MAN_RANGE.finditer(text):
        if not _JP_ANCHOR.search(text[max(0, m.start() - 25): m.start()]):
            continue
        lo = int(float(m.group(1).replace(",", ""))) * 10_000
        hi = int(float(m.group(2).replace(",", ""))) * 10_000
        if hi < lo:
            lo, hi = hi, lo
        if 1_000_000 <= lo <= 100_000_000 and 1_000_000 <= hi <= 100_000_000:
            return {"min": lo, "max": hi, "currency": "JPY", "period": "YEAR"}
    for m in _JP_YEN_RANGE.finditer(text):
        anchor = text[max(0, m.start() - 25): m.start()]
        if not _JP_ANCHOR.search(anchor):
            continue
        lo = int(m.group(1).replace(",", ""))
        hi = int(m.group(2).replace(",", ""))
        if hi < lo:
            lo, hi = hi, lo
        period = "MONTH" if "月給" in anchor else "YEAR"
        if period == "MONTH" and 100_000 <= lo <= 5_000_000 and 100_000 <= hi <= 5_000_000:
            return {"min": lo, "max": hi, "currency": "JPY", "period": period}
        if period == "YEAR" and 1_000_000 <= lo <= 100_000_000 and 1_000_000 <= hi <= 100_000_000:
            return {"min": lo, "max": hi, "currency": "JPY", "period": period}
    return None


def extract_salary_from_description(text: str | None) -> dict | None:
    """본문에서 명시된 연봉 '범위'를 추출. 없으면 None.

    정직성: 'salary/pay/compensation range' 등 명시 문구가 금액 직전(~80자)에
    있어야만 인정(펀딩/매출/지분 $금액 오탐 방지). 범위(두 금액)만, 단일값 제외.
    일본어(年収/月給 + 円/万円)도 함께 처리. 반환 {min,max(원본통화 정수),
    currency(ISO), period(YEAR|MONTH|HOUR)}.
    """
    if not text:
        return None
    for m in _SAL_RANGE.finditer(text):
        # 앵커 탐색 구간은 금액 시작 +8자까지 포함 — "Compensation $X" 처럼 연봉어 바로 뒤에
        # 금액이 오는 형태를 인식하려면(앵커의 금액 lookahead) 금액 앞부분이 보여야 한다.
        if not _SAL_ANCHOR.search(text[max(0, m.start() - 80): m.start() + 8]):
            continue
        # 금액 직전 25자에 지분/펀딩/매출 등 비-연봉 단서가 있으면 스킵(앵커가 통과해도).
        if _SAL_EXCLUDE.search(text[max(0, m.start() - 25): m.start()]):
            continue
        first_sym = m.group("sym")  # 첫 금액 통화기호(없을 수 있음)
        # 통화기호 없는 매칭은 더 엄격히: 두 금액 모두 salary-shaped + 직후 비-금액 명사 제외.
        if not first_sym:
            if not (_is_salary_shaped(m.group("min")) and _is_salary_shaped(m.group("max"))):
                continue
            if _SAL_COUNT_NOUN.match(text[m.end(): m.end() + 20]):
                continue
        lo = _sal_num(m.group("min"), m.group("mdec"), m.group("munit"))
        hi = _sal_num(m.group("max"), m.group("xdec"), m.group("xunit") or m.group("munit"))
        if hi < lo:
            lo, hi = hi, lo
        # 통화: 첫/둘째 금액 기호 → 접두/심볼, 없으면 범위 앞뒤 ~8자의 통화어(CAD/USD 등), 기본 USD.
        cur_sym = (first_sym or m.group("sym2") or "").upper()
        cur = _SAL_PREFIX.get(cur_sym) or _SAL_SYMBOL.get(cur_sym[-1:]) or "USD"
        cw = (_SAL_CUR_WORD.search(text[max(0, m.start() - 8): m.start()].upper())
              or _SAL_CUR_WORD.search(text[m.end(): m.end() + 6].upper()))
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
        else:
            # 연봉 맥락에서 1,000 미만은 'K 누락'($130→$130k) 또는 천단위 표기 깨짐
            # ($170.40→$170,400) → ×1000 복구. 기호 있을 때만(기호 없는 범위는 항상 온전한 숫자).
            if first_sym and lo < 1000 and hi < 1000:
                lo *= 1000
                hi *= 1000
            if not (10_000 <= lo <= 10_000_000 and 10_000 <= hi <= 10_000_000):
                continue
            # 통화 근거(기호·통화코드)가 전혀 없어 USD 로 '가정'한 경우엔 미국 현실 범위만 신뢰한다.
            # 예: "compensation range ... specific to Czech Republic ... 1,480,000"(CZK 코드 없음)을
            # USD 로 오인해 $148만 같은 쓰레기값을 내보내는 것을 막는다(외화 100만대 → 거부).
            cur_evidenced = bool(cur_sym) or bool(cw)
            if not cur_evidenced:
                if period == "YEAR" and not (30_000 <= lo <= 600_000 and 30_000 <= hi <= 700_000):
                    continue
                if period == "MONTH" and not (2_000 <= lo <= 60_000 and 2_000 <= hi <= 60_000):
                    continue
        return {"min": int(lo), "max": int(hi), "currency": cur, "period": period}
    # 영어 패턴이 없으면 일본어(円/万円) 시도.
    return _extract_jp_salary(text)
