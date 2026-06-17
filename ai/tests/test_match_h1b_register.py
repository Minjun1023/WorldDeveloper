from app.etl.visa_reclassify import H1B_EVIDENCE, match_h1b_register


def _job(jid, slug, loc, remote=False):
    return {"id": jid, "company_slug": slug, "location": loc, "is_remote": remote}


def test_flagged_company_us_location_matches():
    jobs = [_job("j1", "stripe", "San Francisco, CA")]
    assert match_h1b_register(jobs, {"stripe"}) == {"j1": ("sponsors", [H1B_EVIDENCE])}


def test_flagged_company_non_us_location_skipped():
    jobs = [_job("j2", "stripe", "Berlin, Germany")]
    assert match_h1b_register(jobs, {"stripe"}) == {}


def test_non_flagged_company_skipped():
    jobs = [_job("j3", "randomco", "Austin, TX")]
    assert match_h1b_register(jobs, {"stripe"}) == {}


def test_empty_location_skipped():
    jobs = [_job("j4", "stripe", None)]
    assert match_h1b_register(jobs, {"stripe"}) == {}
