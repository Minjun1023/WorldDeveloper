from dev_jobs_core.recommender.seniority import seniority_fit_score


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
