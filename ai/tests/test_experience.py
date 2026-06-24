from dev_jobs_core.analyzers.experience import extract_experience_years


def test_plus_years():
    assert extract_experience_years("We need 5+ years of experience in Go") == 5


def test_range_years():
    assert extract_experience_years("3-5 years building backend systems") == 3
    assert extract_experience_years("3 to 5 years experience") == 3


def test_years_of_experience():
    assert extract_experience_years("Minimum 7 years of experience required") == 7
    assert extract_experience_years("at least 4 years") == 4


def test_skips_preferred_picks_required():
    # 'preferred'(우대) 매치는 건너뛰고 본문에서 먼저 나온 '필수' 값을 쓴다.
    assert extract_experience_years("8+ years preferred, 5 years of experience required") == 5


def test_none_when_absent():
    assert extract_experience_years("Bachelor's degree in CS") is None
    assert extract_experience_years("years of experience") is None
    assert extract_experience_years("") is None


def test_ignores_unrealistic_numbers():
    assert extract_experience_years("With 100 years of history") is None


# --- 영어로 풀어쓴 수·변형 (추출 누락 보완) ---

def test_written_out_numbers():
    assert extract_experience_years("seven or more years of experience") == 7
    assert extract_experience_years("five years of experience in Python") == 5
    assert extract_experience_years("at least two years of leadership experience") == 2


def test_or_more_and_yrs_and_apostrophe():
    assert extract_experience_years("5 or more years of experience") == 5
    assert extract_experience_years("5+ yrs of backend experience") == 5
    assert extract_experience_years("5 years' experience with distributed systems") == 5


def test_composite_picks_primary_not_subset():
    # CoreWeave 류: 전체 7년+ / 그중 리더십 2년+ → 본 요건 7 을 골라야 한다(부수 2 아님).
    text = (
        "You have seven or more years of experience in a software or infrastructure "
        "engineering industry, of which at least two years were in a leadership capacity."
    )
    assert extract_experience_years(text) == 7


def test_written_numbers_no_false_positive():
    # 'one year ago' / 'within one year' 처럼 경력 요건이 아닌 'one year' 는 잡지 않는다.
    assert extract_experience_years("Joined the team one year ago") is None
    assert extract_experience_years("Ships to production within one year of start") is None
