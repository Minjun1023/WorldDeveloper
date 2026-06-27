"""_to_usd_year 통화/주기 정규화 — 특히 저액 통화의 ×2080 오왜곡 회귀 방지."""
from dev_jobs_core.analyzers.salary import _to_usd_year


def test_usd_hourly_sent_as_year_is_reinterpreted():
    # $21/h 를 YEAR 로 잘못 보낸 케이스 → 시급으로 재해석(×40×52)
    assert _to_usd_year(21, "USD", "YEAR") == 21 * 40 * 52


def test_low_inr_annual_salary_not_multiplied():
    # INR 300,000 연봉(=USD 3,600) 은 USD 5000 미만이지만 ×2080 되면 안 됨(비-USD)
    got = _to_usd_year(300_000, "INR", "YEAR")
    assert got == 300_000 * 0.012  # 정상 연봉 환산값 유지
    assert got < 5000  # 휴리스틱 임계 안이지만 보정 미적용


def test_normal_usd_year_untouched():
    assert _to_usd_year(120_000, "USD", "YEAR") == 120_000


def test_hour_period_explicit():
    assert _to_usd_year(50, "USD", "HOUR") == 50 * 40 * 52


def test_unknown_currency_returns_none():
    assert _to_usd_year(100, "XYZ", "YEAR") is None
