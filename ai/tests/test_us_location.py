from dev_jobs_core.analyzers.us_location import is_us_location


def test_strong_country_signals():
    assert is_us_location("United States")
    assert is_us_location("Remote, USA")
    assert is_us_location("Remote (US)")
    assert is_us_location("Remote - United States")
    assert is_us_location("Remote, U.S.")
    assert is_us_location("U.S.A.")


def test_full_state_names():
    for s in ["San Jose, California", "Austin, Texas", "Seattle, Washington",
              "Denver, Colorado", "Boston, Massachusetts"]:
        assert is_us_location(s), s


def test_major_cities():
    for c in ["San Francisco", "New York", "Seattle", "Austin", "Mountain View", "Palo Alto"]:
        assert is_us_location(c), c


def test_state_abbreviation_only_in_comma_pattern():
    assert is_us_location("Austin, TX")
    assert is_us_location("San Francisco, CA")
    assert is_us_location("New York, NY")


def test_no_false_positive_from_lowercase_words():
    for loc in ["Remote or hybrid", "working in office", "ok with remote",
                "call me maybe"]:
        assert is_us_location(loc) is False, loc


def test_non_us():
    for loc in ["Berlin, Germany", "London, UK", "Remote - Europe",
                "Amsterdam", "Paris, France", "Remote"]:
        assert is_us_location(loc) is False, loc


def test_empty():
    assert is_us_location(None) is False
    assert is_us_location("") is False
