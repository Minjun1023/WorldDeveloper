from dev_jobs_core.analyzers.experience import extract_experience_years


def test_plus_years():
    assert extract_experience_years("We need 5+ years of experience in Go") == 5


def test_range_years():
    assert extract_experience_years("3-5 years building backend systems") == 3
    assert extract_experience_years("3 to 5 years experience") == 3


def test_years_of_experience():
    assert extract_experience_years("Minimum 7 years of experience required") == 7
    assert extract_experience_years("at least 4 years") == 4


def test_picks_minimum_when_multiple():
    assert extract_experience_years("8+ years preferred, 5 years of experience required") == 5


def test_none_when_absent():
    assert extract_experience_years("Bachelor's degree in CS") is None
    assert extract_experience_years("years of experience") is None
    assert extract_experience_years("") is None


def test_ignores_unrealistic_numbers():
    assert extract_experience_years("With 100 years of history") is None
