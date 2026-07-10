from app.etl.visa_reclassify import CA_EVIDENCE, match_ca_register


def _job(jid, slug, loc, remote=False):
    return {"id": jid, "company_slug": slug, "location": loc, "is_remote": remote}


def test_flagged_company_ca_location_matches():
    jobs = [_job("j1", "shopify", "Toronto, Ontario, Canada")]
    out = match_ca_register(jobs, {"shopify"})
    assert out == {"j1": ("sponsors", [CA_EVIDENCE])}


def test_flagged_company_province_only_matches():
    jobs = [_job("j2", "shopify", "Vancouver, British Columbia")]
    assert match_ca_register(jobs, {"shopify"}) == {"j2": ("sponsors", [CA_EVIDENCE])}


def test_flagged_company_non_ca_location_skipped():
    jobs = [_job("j3", "shopify", "Berlin, Germany")]
    assert match_ca_register(jobs, {"shopify"}) == {}


def test_non_flagged_company_skipped():
    jobs = [_job("j4", "randomco", "Toronto, Canada")]
    assert match_ca_register(jobs, {"shopify"}) == {}


def test_empty_location_skipped():
    jobs = [_job("j5", "shopify", None)]
    assert match_ca_register(jobs, {"shopify"}) == {}
