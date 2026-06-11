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


def test_member_of_technical_staff_is_not_staff_seniority():
    # 'Member of Technical Staff' = AI 랩의 일반 IC 직함, Staff 시니어리티 아님
    assert extract_seniority("Member of Technical Staff (Software Engineer)") is None
    assert extract_seniority("Member of Technical Staff (AI Researcher)") is None


def test_real_staff_engineer_still_detected():
    assert extract_seniority("Staff Software Engineer") == "Staff"
    assert extract_seniority("Senior Staff Engineer") == "Staff"  # 더 높은 직급 우선
