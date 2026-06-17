from app.etl.visa_reclassify import UK_EVIDENCE, match_uk_register


def _job(jid, slug, loc, remote=False):
    return {"id": jid, "company_slug": slug, "location": loc, "is_remote": remote}


def test_flagged_company_uk_location_matches():
    jobs = [_job("j1", "monzo", "London, UK")]
    out = match_uk_register(jobs, {"monzo"})
    assert out == {"j1": ("sponsors", [UK_EVIDENCE])}


def test_flagged_company_non_uk_location_skipped():
    jobs = [_job("j2", "monzo", "Berlin, Germany")]
    assert match_uk_register(jobs, {"monzo"}) == {}


def test_non_flagged_company_skipped():
    jobs = [_job("j3", "randomco", "London, UK")]
    assert match_uk_register(jobs, {"monzo"}) == {}


def test_empty_location_skipped():
    jobs = [_job("j4", "monzo", None)]
    assert match_uk_register(jobs, {"monzo"}) == {}
