from dev_jobs_core.analyzers.visa import classify_visa


def test_no_sponsor_authorized_to_work():
    assert classify_visa("You must be authorized to work in the United States.")[0] == "no_sponsor"


def test_no_sponsor_without_sponsorship():
    assert classify_visa("This role is available without sponsorship.")[0] == "no_sponsor"


def test_sponsor_visa_support():
    assert classify_visa("We provide visa support and relocation reimbursement.")[0] == "sponsors"


def test_sponsor_we_sponsor_visas():
    assert classify_visa("We sponsor work visas for the right candidate.")[0] == "sponsors"


def test_no_sponsor_subject_first_not_available():
    # 주어-우선 어순(기존 do/does not 패턴이 못 잡던 형태)
    assert classify_visa("Please note that visa sponsorship is not available for this role.")[0] == "no_sponsor"


def test_no_sponsor_not_provided():
    assert classify_visa("Sponsorship is not provided.")[0] == "no_sponsor"


def test_no_sponsor_not_able_to_provide_sponsorship():
    assert classify_visa("Unfortunately we are not able to provide visa sponsorship.")[0] == "no_sponsor"


def test_sponsor_affirmative_available_still_sponsors():
    # 긍정형 "sponsorship is available" 은 새 거부 패턴에 걸리지 않아야 한다
    assert classify_visa("Visa sponsorship is available for this role.")[0] == "sponsors"


def test_unclear_silent():
    assert classify_visa("Great team, Python and Go, fast-paced startup.")[0] == "unclear"


def test_empty_unclear():
    assert classify_visa("")[0] == "unclear"
