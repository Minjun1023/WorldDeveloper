from dev_jobs_core.analyzers.uk_location import is_uk_location


def test_uk_country_and_region_signals():
    assert is_uk_location("United Kingdom")
    assert is_uk_location("London, UK")
    assert is_uk_location("Edinburgh, Scotland")
    assert is_uk_location("Cardiff, Wales")
    assert is_uk_location("Belfast, Northern Ireland")


def test_uk_cities():
    for c in ["London", "Manchester", "Bristol", "Cambridge", "Leeds", "Glasgow"]:
        assert is_uk_location(c), c


def test_remote_uk():
    assert is_uk_location("Remote (UK)")
    assert is_uk_location("Remote - United Kingdom")
    assert is_uk_location("Remote", is_remote=True) is False  # 모호한 remote 는 UK 아님


def test_non_uk():
    for loc in ["Berlin, Germany", "New York, NY", "Remote - Europe",
                "Amsterdam", "Paris, France", "Remote"]:
        assert is_uk_location(loc) is False, loc


def test_empty():
    assert is_uk_location(None) is False
    assert is_uk_location("") is False


def test_word_boundary_no_false_positive():
    # 'uk' 가 단어 일부인 경우 오탐 금지
    assert is_uk_location("Fukuoka, Japan") is False
