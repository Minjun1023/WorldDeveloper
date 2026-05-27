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


def test_drops_legal_titles():
    # 실측 누수: 다양한 Counsel/Legal 직함
    assert not is_dev_role("Litigation Counsel")
    assert not is_dev_role("Commercial Counsel, Procurement")
    assert not is_dev_role("Associate Product Counsel")
    assert not is_dev_role("Assistant General Counsel, Employment")
    assert not is_dev_role("Senior Counsel")
    assert not is_dev_role("Legal Vendor Program Manager")
    assert not is_dev_role("Genetic Counseling Assistant")  # "counsel" 부분일치


def test_drops_bizdev_and_partnership():
    assert not is_dev_role("Amazon GTM Partnership, Startups")
    assert not is_dev_role("Strategic Partnerships Lead")
    assert not is_dev_role("Community Manager, Social")


def test_drops_abbreviations_and_variants():
    # 약어/변형도 잡아야 함
    assert not is_dev_role("Commercial Account Exec")
    assert not is_dev_role("Sr Enterprise Account Exec")
    assert not is_dev_role("Recruitment Consultant (m/w/d)")


def test_drops_program_project_ops_managers():
    assert not is_dev_role("Bilingual Staff Technical Program Manager")
    assert not is_dev_role("Senior Project Manager")
    assert not is_dev_role("Operations Manager")
    assert not is_dev_role("E Commerce Growth Manager")
    assert not is_dev_role("Digital Web Growth Manager")


def test_drops_assistants_and_specialists():
    assert not is_dev_role("Virtual Assistant Panelist")
    assert not is_dev_role("Executive Assistant to the CEO")
    assert not is_dev_role("Implementation Specialist (Contractor)")
    assert not is_dev_role("Customer Onboarding Specialist")
    assert not is_dev_role("Administrative Coordinator")


def test_does_not_overdeny_real_engineering_roles():
    # 강화된 deny 가 진짜 개발 직함을 떨어뜨리면 안 됨(재현율 보호)
    assert is_dev_role("Engineering Manager")          # bare "manager" 는 deny 아님
    assert is_dev_role("Growth Engineer")              # "growth manager" 만 deny
    assert is_dev_role("Site Reliability Engineer")
    assert is_dev_role("Staff Software Engineer, Platform")
    assert is_dev_role("Developer Advocate")
    assert is_dev_role("Engineering Program")          # "program manager" 만 deny
    assert is_dev_role("Mobile Engineer (iOS)")
    assert is_dev_role("Data Engineer")
