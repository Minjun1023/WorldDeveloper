from dev_jobs_core.sources import ashby

# 실제 Ashby Posting API 구조(ramp). minValue/maxValue/currencyCode/interval 가
# component 에 '직접' 들어있다 — 중첩 'value' 키는 없다(과거 버그의 원인).
COMP_REAL = {
    "compensationTierSummary": "$211.4K – $290.6K • Offers Equity",
    "scrapeableCompensationSalarySummary": "$211.4K - $290.6K",
    "compensationTiers": [
        {
            "tierSummary": "$211.4K – $290.6K",
            "components": [
                {"compensationType": "Salary", "interval": "1 YEAR",
                 "currencyCode": "USD", "minValue": 211400, "maxValue": 290600},
                {"compensationType": "EquityPercentage", "interval": "NONE",
                 "currencyCode": None, "minValue": None, "maxValue": None},
            ],
        }
    ],
    "summaryComponents": [
        {"compensationType": "Salary", "interval": "1 YEAR",
         "currencyCode": "USD", "minValue": 211400, "maxValue": 290600},
    ],
}


def test_salary_from_comp_extracts_range():
    assert ashby._salary_from_comp(COMP_REAL) == (211400, 290600, "USD", "YEAR")


def test_salary_from_comp_empty_returns_none():
    # crusoe 처럼 compensation 키는 있으나 내용이 빈 경우
    empty = {"compensationTierSummary": None, "compensationTiers": [], "summaryComponents": []}
    assert ashby._salary_from_comp(empty) == (None, None, "", "")
    assert ashby._salary_from_comp({}) == (None, None, "", "")


def test_salary_from_comp_falls_back_to_summary_components():
    # compensationTiers 가 비어도 summaryComponents 로 추출, interval 매핑 확인
    only_summary = {"compensationTiers": [], "summaryComponents": [
        {"compensationType": "Salary", "interval": "1 MONTH",
         "currencyCode": "EUR", "minValue": 5000, "maxValue": 7000}]}
    assert ashby._salary_from_comp(only_summary) == (5000, 7000, "EUR", "MONTH")


def test_salary_from_comp_skips_non_salary_only():
    only_equity = {"compensationTiers": [{"components": [
        {"compensationType": "EquityPercentage", "minValue": None, "maxValue": None}]}],
        "summaryComponents": []}
    assert ashby._salary_from_comp(only_equity) == (None, None, "", "")
