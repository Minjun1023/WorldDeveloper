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


def test_rejects_equity_value_range():
    # 지분 가치 범위 — '연봉어'가 range 와 떨어져 있고 'options/value range' 맥락 → 거부
    assert ex("The compensation package includes options with a value range of $50,000 to $250,000") is None


def test_rejects_revenue_band():
    assert ex("Our compensation philosophy: the team's revenue target band is $1,000,000 to $5,000,000") is None


def test_rejects_equity_grant_after_anchor():
    # 앵커(compensation band)는 있으나 금액 직전이 'equity grants' → 제외 가드로 거부
    assert ex("Compensation band aside, equity grants of $80,000 to $300,000 vest over 4 years") is None


def test_rejects_legal_damages():
    assert ex("Compensation for damages can range from $10,000 to $90,000") is None


def test_rejects_contract_value():
    assert ex("Our annual compensation review; annual contract value of $50,000 to $250,000") is None


def test_keeps_annual_salary_phrasing():
    # 정상 'Annual Salary:' 표기는 유지(리콜 보존)
    r = ex("Annual Salary: £255,000 — £325,000 GBP")
    assert r["currency"] == "GBP" and r["min"] == 255000 and r["max"] == 325000


def test_none_and_empty():
    assert ex(None) is None and ex("") is None and ex("no pay here") is None


def test_jp_annual_man_range():
    # 年収 600万円〜1,000万円 → 6,000,000 ~ 10,000,000 JPY/YEAR
    r = ex("給与 年収 600万円〜1,000万円 ※経験により決定")
    assert r == {"min": 6_000_000, "max": 10_000_000, "currency": "JPY", "period": "YEAR"}


def test_jp_annual_man_range_no_first_unit():
    r = ex("想定年収：800〜1200万円")
    assert r == {"min": 8_000_000, "max": 12_000_000, "currency": "JPY", "period": "YEAR"}


def test_jp_monthly_yen_range():
    # 月給：584,000円〜917,000円 → MONTH
    r = ex("給与 月給 584,000円〜917,000円 時間外手当別途")
    assert r == {"min": 584_000, "max": 917_000, "currency": "JPY", "period": "MONTH"}


def test_jp_requires_anchor():
    # 年収/月給 앵커 없는 万円 숫자(매출·자본금 등)는 무시.
    assert ex("資本金 5000万円〜1億円規模の成長企業") is None


def test_jp_english_takes_priority():
    # 영어 명시 범위가 있으면 그걸 우선(일본어 폴백은 영어 실패 시만).
    r = ex("The base salary range is $150,000 to $200,000. 年収 800万円〜1000万円")
    assert r["currency"] == "USD"


def test_space_separated_range_with_currency():
    # 대시 없이 공백 구분 + 둘째 금액도 $ — Databricks "Local Pay Range$130,000 $160,000 USD" 류
    r = ex("Local Pay Range $130,000 $160,000 USD")
    assert r == {"min": 130000, "max": 160000, "currency": "USD", "period": "YEAR"}


def test_hourly_rate_space_separated():
    # "Hourly Rate" 앵커 + 공백 구분 시급
    r = ex("SF Bay Area Hourly Rate $54 $60 USD")
    assert r == {"min": 54, "max": 60, "currency": "USD", "period": "HOUR"}


def test_recovers_malformed_decimal_thousands():
    # "$170.40 $255.60" — 천단위 표기 깨짐(실제 $170,400~$255,600). 연봉 맥락 + 1000 미만 → ×1000 복구.
    r = ex("Local Pay Range $170.40 $255.60 USD")
    assert r == {"min": 170400, "max": 255600, "currency": "USD", "period": "YEAR"}


def test_recovers_dropped_k():
    # 'K' 누락: "$130 $160" 가 연봉 맥락이면 $130k~$160k 로 복구.
    r = ex("Annual salary range $130 $160 USD")
    assert r == {"min": 130000, "max": 160000, "currency": "USD", "period": "YEAR"}


def test_space_separator_requires_second_currency():
    # 공백 구분은 둘째 금액에 통화기호 필수 — 없으면 범위로 보지 않음(단일값 → None)
    assert ex("Base salary range $130,000 and great benefits") is None


# --- 통화기호 없는/형식 깨진 실제 공고 복구 (운영 false-negative 358건 대상) ---

def test_recovers_range_without_currency_symbol():
    # Affirm: "CAN base pay range per year: 153,000 - 213,000" ($ 없음, 콤마 범위)
    r = ex("CAN base pay range per year: 153,000 - 213,000 #LI-Remote")
    assert r == {"min": 153000, "max": 213000, "currency": "USD", "period": "YEAR"}


def test_recovers_first_number_missing_symbol():
    # Harvey: 첫 금액에만 $ 누락 "Salary Range: 40 hours/week; 230,000 - $270,000/year"
    r = ex("Salary Range: 40 hours/week; 230,000 - $270,000/year Job Description")
    assert r == {"min": 230000, "max": 270000, "currency": "USD", "period": "YEAR"}


def test_recovers_text_currency_code():
    # Asana: "salary range is between CAD 211,000-240,000" (텍스트 통화코드)
    r = ex("The salary range is between CAD 211,000-240,000. The actual base salary")
    assert r["min"] == 211000 and r["max"] == 240000 and r["currency"] == "CAD"


def test_recovers_word_between_salary_and_range():
    # Calendly: "Tier 1 Salary Hiring Range $202,542 — $245,434 USD" (salary↔range 사이 단어)
    r = ex("Tier 1 Salary Hiring Range $202,542 — $245,434 USD Tier 2")
    assert r == {"min": 202542, "max": 245434, "currency": "USD", "period": "YEAR"}


def test_recovers_compensation_immediately_before_amount():
    # Harvey: "Compensation $188,000 - $282,000" (compensation 바로 뒤 금액, range/콜론 없음)
    r = ex("Compensation $188,000 - $282,000 Depending on your location")
    assert r == {"min": 188000, "max": 282000, "currency": "USD", "period": "YEAR"}


# --- 통화기호 없는 매칭의 오탐 가드 ---

def test_rejects_symbolless_employee_count():
    # 앵커가 있어도 직후 명사(employees)면 연봉 아님
    assert ex("Our salary range supports teams of 50,000 - 100,000 employees") is None


def test_rejects_symbolless_small_numbers():
    # salary-shaped(콤마/5자리+) 아닌 작은 숫자는 범위로 보지 않음
    assert ex("This salary band covers levels 10 - 15 across the org") is None


def test_rejects_symbolless_year_range():
    # 4자리 연도 범위는 salary-shaped 아님 → 무시
    assert ex("Annual salary review cycle runs 2020 - 2024 each period") is None


def test_recovers_czk_annual_currency_code():
    # Fireblocks: "compensation range ... CZK 1,384,000 – 1,800,000 gross annually" (USD 로 오인 금지)
    r = ex("The estimated compensation range for this role is CZK 1,384,000 – 1,800,000 gross annually.")
    assert r == {"min": 1384000, "max": 1800000, "currency": "CZK", "period": "YEAR"}


def test_recovers_pln_monthly_currency_code():
    # Asana: "base salary range is between 40,750 - 46,333 PLN gross per month"
    r = ex("the estimated base salary range is between 40,750 - 46,333 PLN gross per month")
    assert r == {"min": 40750, "max": 46333, "currency": "PLN", "period": "MONTH"}


def test_rejects_guessed_usd_implausible_magnitude():
    # 통화코드 없는 체코(CZK 100만대)를 USD 로 오인하면 $148만 → 거부(미국 범위 밖).
    assert ex("The base salary range for this role, specific to Czech Republic, is 1,480,000 - 1,945,000 gross.") is None


def test_keeps_symbolless_usd_within_us_range():
    # 통화코드 없어도 미국 현실 범위면 USD 로 유지(Affirm CAN/USA base pay 류).
    r = ex("USA base pay range per year: 153,000 - 213,000")
    assert r == {"min": 153000, "max": 213000, "currency": "USD", "period": "YEAR"}


def test_pay_transparency_suffix_no_nearby_anchor():
    """미국 공시 포맷 — 연봉어가 80자 밖(지역 나열)이어도 '$X — $Y USD'는 인정."""
    t = ("Below is the annual base salary range for candidates located in California."
         " Your recruiter can share more. US, CA, San Francisco, New York, Seattle"
         " compensation zones apply here today: $165,200 — $223,600 USD Twitch is an equal opportunity employer.")
    r = ex(t)
    assert r == {"min": 165200, "max": 223600, "currency": "USD", "period": "YEAR"}


def test_no_anchor_no_iso_suffix_still_rejected():
    """강한 통화 증거(기호+ISO 접미) 없으면 여전히 앵커 필수 — 펀딩 금액 오탐 방지."""
    t = "We raised a huge round. Our valuation grew fast: $150,000 - $200,000 something."
    assert ex(t) is None
