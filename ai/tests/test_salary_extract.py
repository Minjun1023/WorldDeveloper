from dev_jobs_core.analyzers.salary import extract_salary_from_description as ex


def test_usd_range_with_anchor():
    r = ex("The base salary range for this role is $188,000 to $250,000.")
    assert r == {"min": 188000, "max": 250000, "currency": "USD", "period": "YEAR"}


def test_gbp_range():
    r = ex("Base salary range: £65,600 - £98,400 depending on experience")
    assert r["currency"] == "GBP" and r["min"] == 65600 and r["max"] == 98400


def test_eur_and_usd_suffix_word():
    assert ex("The pay range for this role is €135,000 - €160,000")["currency"] == "EUR"
    assert ex("Base Salary Range $130,000 — $160,000 USD")["currency"] == "USD"


def test_k_suffix():
    r = ex("Compensation: salary range of $130K to $160K")
    assert r["min"] == 130000 and r["max"] == 160000


def test_hourly():
    r = ex("The pay range for this position is $30 to $45 per hour")
    assert r["period"] == "HOUR" and r["min"] == 30 and r["max"] == 45


def test_rejects_funding():
    assert ex("We raised $100M to $150M in Series C funding") is None


def test_rejects_no_anchor():
    assert ex("Our customers spend $40,000 to $90,000 annually on the platform") is None


def test_rejects_single_value():
    assert ex("The base salary is $150,000 for this role") is None


def test_none_and_empty():
    assert ex(None) is None and ex("") is None and ex("no pay here") is None
