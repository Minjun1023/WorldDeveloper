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
