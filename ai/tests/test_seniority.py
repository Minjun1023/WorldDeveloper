from dev_jobs_core.analyzers.seniority import extract_seniority


def test_levels():
    assert extract_seniority("Senior Software Engineer") == "Senior"
    assert extract_seniority("Staff Backend Engineer") == "Staff"
    assert extract_seniority("Principal Engineer, Platform") == "Principal"
    assert extract_seniority("Junior Developer") == "Junior"
    assert extract_seniority("Engineering Intern") == "Intern"
    assert extract_seniority("Sr. Data Scientist") == "Senior"
    assert extract_seniority("Tech Lead, Payments") == "Lead"


def test_priority_principal_over_senior():
    assert extract_seniority("Principal Senior Engineer") == "Principal"


def test_no_false_positive_on_substrings():
    assert extract_seniority("Leading Platform Engineer") is None
    assert extract_seniority("Software Engineer") is None
    assert extract_seniority("") is None
