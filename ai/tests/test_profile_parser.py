from app.profile_parser import parse_rules


def test_full_korean_sentence():
    p = parse_rules("3년차 백엔드, Go·Python, 베를린 선호, 비자 스폰서 필요")
    assert "Go" in p.skills and "Python" in p.skills
    assert p.years_experience == 3
    assert p.seniority == "mid"
    assert p.preferred_locations == ["Berlin"]
    assert p.needs_visa_sponsorship is True
    assert p.sufficient is True


def test_remote_and_salary_english():
    p = parse_rules("junior frontend, React, remote, €60k")
    assert "React" in p.skills
    assert p.seniority == "junior"
    assert p.remote_preference == "remote"
    assert "Remote" in p.preferred_locations
    assert p.desired_salary_usd == int(60000 * 1.08)
    assert p.sufficient is True


def test_garbage_input_is_insufficient():
    p = parse_rules("안녕하세요")
    assert p.skills == []
    assert p.preferred_locations == []
    assert p.seniority is None
    assert p.sufficient is False
