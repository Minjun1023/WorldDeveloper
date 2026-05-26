from dev_jobs_core.analyzers.visa import classify_visa


def test_no_sponsor_authorized_to_work():
    assert classify_visa("You must be authorized to work in the United States.")[0] == "no_sponsor"


def test_no_sponsor_without_sponsorship():
    assert classify_visa("This role is available without sponsorship.")[0] == "no_sponsor"


def test_sponsor_visa_support():
    assert classify_visa("We provide visa support and relocation reimbursement.")[0] == "sponsors"


def test_sponsor_we_sponsor_visas():
    assert classify_visa("We sponsor work visas for the right candidate.")[0] == "sponsors"


def test_unclear_silent():
    assert classify_visa("Great team, Python and Go, fast-paced startup.")[0] == "unclear"


def test_empty_unclear():
    assert classify_visa("")[0] == "unclear"
