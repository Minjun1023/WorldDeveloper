from dev_jobs_core.analyzers.remote_geo import classify_remote_eligibility as cls


def test_not_remote_returns_none():
    assert cls("New York, US", False, "")[0] is None


def test_worldwide_location():
    assert cls("Remote - Worldwide", True, "")[0] == "worldwide"


def test_work_from_anywhere_in_description():
    assert cls("Remote", True, "You can work from anywhere.")[0] == "worldwide"


def test_apac_region():
    assert cls("Remote - APAC", True, "")[0] == "apac_ok"


def test_korea_location():
    assert cls("Seoul, South Korea", True, "")[0] == "apac_ok"


def test_us_location_restricted():
    assert cls("Remote (US)", True, "")[0] == "region_restricted"


def test_europe_location_restricted():
    assert cls("Remote, Europe", True, "")[0] == "region_restricted"


def test_japan_single_country_restricted():
    # 특정 다른 APAC 국가 단독은 한국 제외 → restricted
    assert cls("Tokyo, Japan", True, "")[0] == "region_restricted"


def test_strong_phrase_beats_worldwide():
    # 명시적 lock-out 은 worldwide 신호가 있어도 이긴다 (헛된 희망 방지)
    assert cls("Remote - Worldwide", True, "You must be based in the US.")[0] == "region_restricted"


def test_timezone_overlap_restricted():
    assert cls("Remote", True, "Requires overlap with US timezone.")[0] == "region_restricted"


def test_bare_remote_unclear():
    # 권역 명시 없는 원격은 worldwide 로 추정하지 않고 정직하게 unclear
    assert cls("Remote", True, "Great team, Python and Go.")[0] == "unclear"


def test_empty_location_unclear():
    assert cls("", True, "")[0] == "unclear"


def test_evidence_returned():
    status, ev = cls("Remote (US)", True, "")
    assert status == "region_restricted"
    assert len(ev) >= 1
