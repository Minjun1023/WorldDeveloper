from app.etl.visa_reclassify import IND_EVIDENCE, match_ind_register


def _job(jid, slug, loc, remote=False):
    return {"id": jid, "company_slug": slug, "location": loc, "is_remote": remote}


def test_flagged_company_nl_location_matches():
    jobs = [_job("j1", "adyen", "Amsterdam, Netherlands")]
    out = match_ind_register(jobs, {"adyen"})
    assert out == {"j1": ("sponsors", [IND_EVIDENCE])}


def test_nl_country_code_matches():
    jobs = [_job("j2", "adyen", "Amsterdam, NL")]
    assert match_ind_register(jobs, {"adyen"}) == {"j2": ("sponsors", [IND_EVIDENCE])}


def test_flagged_company_non_nl_location_skipped():
    jobs = [_job("j3", "adyen", "Berlin, Germany")]
    assert match_ind_register(jobs, {"adyen"}) == {}


def test_non_flagged_company_skipped():
    jobs = [_job("j4", "randomco", "Amsterdam, Netherlands")]
    assert match_ind_register(jobs, {"adyen"}) == {}


def test_empty_location_skipped():
    jobs = [_job("j5", "adyen", None)]
    assert match_ind_register(jobs, {"adyen"}) == {}


def test_lowercase_nl_substring_not_matched():
    # 소문자 'nl'(예 다른 토큰 내부)은 국가코드로 오인하지 않는다
    jobs = [_job("j6", "adyen", "remote (mysql team)")]
    assert match_ind_register(jobs, {"adyen"}) == {}
