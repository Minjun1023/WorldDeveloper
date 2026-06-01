from app.etl.viability import is_dead_end


def test_no_sponsor_onsite_is_dead_end():
    assert is_dead_end("no_sponsor", False, None) is True


def test_no_sponsor_region_restricted_is_dead_end():
    assert is_dead_end("no_sponsor", True, "region_restricted") is True


def test_no_sponsor_but_worldwide_remote_is_viable():
    assert is_dead_end("no_sponsor", True, "worldwide") is False


def test_no_sponsor_but_apac_remote_is_viable():
    assert is_dead_end("no_sponsor", True, "apac_ok") is False


def test_no_sponsor_remote_unclear_not_dead_end():
    # unclear 는 절대 드롭하지 않는다 (기본 숨김은 조회 계층에서)
    assert is_dead_end("no_sponsor", True, "unclear") is False


def test_sponsors_never_dead_end():
    assert is_dead_end("sponsors", False, None) is False


def test_unclear_visa_never_dead_end():
    assert is_dead_end("unclear", False, None) is False
