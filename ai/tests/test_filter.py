from dev_jobs_core.filter import is_dev_role


def test_keeps_engineering_titles():
    assert is_dev_role("Senior Backend Engineer")
    assert is_dev_role("Software Developer")
    assert is_dev_role("DevOps / SRE")
    assert is_dev_role("Machine Learning Engineer")


def test_drops_non_dev_titles():
    assert not is_dev_role("Account Executive (Sales)")
    assert not is_dev_role("Technical Recruiter")
    assert not is_dev_role("Product Marketing Manager")
    assert not is_dev_role("Product Manager")
    assert not is_dev_role("Senior Product Designer")


def test_ambiguous_kept_recall_first():
    assert is_dev_role("Data Analyst")
    assert is_dev_role("Solutions Architect")
