from dev_jobs_core.recommender.seniority import detect_seniority, seniority_fit_score


def test_detect_non_senior_not_senior():
    # 'non-senior'/'non senior'(주니어 친화)를 senior 로 오분류하면 안 됨
    assert detect_seniority("Non-senior friendly role", "") != "senior"
    assert detect_seniority("Non senior backend role", "") != "senior"
    # 진짜 senior 는 그대로
    assert detect_seniority("Senior Backend Engineer", "") == "senior"


def test_detect_roman_ii_only_as_level_suffix():
    # 레벨 접미일 때만 mid (제목 끝/구분자 앞), 일반 'ii' 오탐 금지
    assert detect_seniority("Software Engineer II", "") == "mid"
    assert detect_seniority("Engineer II, Backend", "") == "mid"
    assert detect_seniority("Engineer II (Remote)", "") == "mid"
    assert detect_seniority("Engineer (Phase ii)", "") != "mid"
    assert detect_seniority("World War II Historian Dev", "") != "mid"


def test_fit_score_handles_none_level():
    # user/job 레벨이 None 이어도 AttributeError 없이 중립(0.5)
    assert seniority_fit_score(None, "senior") == 0.5
    assert seniority_fit_score("senior", None) == 0.5


def test_entry_user_matches_junior_level():
    # 'entry'(프로필 신입)가 SENIORITY_ORDER 에 없어 중립(0.5)으로 죽던 버그 — junior 단계로 매칭돼야 한다.
    assert seniority_fit_score("entry", "junior") == 1.0
    assert seniority_fit_score("entry", "mid") == 0.6


def test_exact_and_distance():
    assert seniority_fit_score("senior", "senior") == 1.0
    assert seniority_fit_score("senior", "staff") == 0.6
    assert seniority_fit_score("senior", "principal") == 0.3
    assert seniority_fit_score("junior", "principal") == 0.1  # diff 4 → 먼 거리


def test_unspecified_neutral():
    assert seniority_fit_score("senior", "unspecified") == 0.5
    assert seniority_fit_score("unspecified", "senior") == 0.5
