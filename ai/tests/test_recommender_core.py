"""매칭 코어(scorer.py / engine.py) 단위 테스트.

차원별 점수 함수, 가중 합산, deal-breaker 패널티, 다양성 제약,
그리고 engine.recommend() 의 게이트/정렬을 검증한다.

임베딩(semantic)은 결정론적으로 모킹하여 모델 로드 없이 빠르게 돈다.
"""
import asyncio

import pytest

from dev_jobs_core.models import JobPosting
from dev_jobs_core.recommender import scorer
from dev_jobs_core.recommender.engine import recommend
from dev_jobs_core.recommender.profile import DEFAULT_WEIGHTS, UserProfile, parse_weights


@pytest.fixture(autouse=True)
def _stub_embeddings(monkeypatch):
    """의미 유사도를 고정값으로 만들어 모델 로드 없이 결정론적으로 테스트."""
    monkeypatch.setattr(scorer.embeddings, "is_available", lambda: True)
    monkeypatch.setattr(scorer.embeddings, "cosine_similarity", lambda a, b: 0.5)


def _job(jid="test:1", title="Senior Backend Engineer", company="Acme",
         tags=None, **kw):
    tags = tags if tags is not None else ["python", "django"]
    return JobPosting(
        job_id=jid, source="test", title=title, company=company,
        description=kw.pop("description", title), tags=tags, **kw,
    )


def _user(**kw):
    base = dict(skills=["python", "django", "aws"], seniority="senior",
               years_experience=6)
    base.update(kw)
    return UserProfile(**base)


# ---------- score_stack ----------

def test_stack_full_match():
    # 3개 이상 매칭이어야 abs_bonus 가 만점(1.0)에 도달
    s, matched, missing = scorer.score_stack(
        ["python", "django", "aws"], _job(tags=["python", "django", "aws"]))
    assert s == pytest.approx(1.0, abs=1e-6)
    assert matched == ["aws", "django", "python"]
    assert missing == []


def test_stack_two_match_capped_by_abs_bonus():
    # 전부 매칭이라도 매칭 개수가 2면 abs_bonus=2/3 → 0.6*1 + 0.4*(2/3)
    s, _, missing = scorer.score_stack(
        ["python", "django"], _job(tags=["python", "django"]))
    assert s == pytest.approx(0.6 + 0.4 * (2 / 3), abs=1e-6)
    assert missing == []


def test_stack_no_tags_is_penalized_not_neutral():
    # 스택 미확인 공고는 0.25 로 강등 (중립 0.5 가 아님)
    s, matched, missing = scorer.score_stack(
        ["python"], _job(tags=[], description=""))
    assert s == 0.25


def test_stack_partial_match_between():
    s, _, missing = scorer.score_stack(
        ["python"], _job(tags=["python", "go", "rust", "kafka"]))
    assert 0.0 < s < 1.0
    assert "go" in missing


# ---------- score_visa ----------

@pytest.mark.parametrize("status,expected", [
    ("sponsors", 1.0), ("unclear", 0.4), ("no_sponsor", 0.0)])
def test_visa_status_scores(status, expected):
    s, _ = scorer.score_visa(_user(needs_visa_sponsorship=True),
                             _job(visa_status=status))
    assert s == expected


def test_visa_not_needed_is_full():
    s, _ = scorer.score_visa(_user(needs_visa_sponsorship=False),
                             _job(visa_status="no_sponsor"))
    assert s == 1.0


def test_visa_nonstandard_status_no_keyerror():
    # 비표준 visa_status 값에도 reason 인덱싱이 KeyError 로 죽지 않아야 함
    s, reason = scorer.score_visa(_user(needs_visa_sponsorship=True),
                                  _job(visa_status="pending"))
    assert s == 0.4
    assert isinstance(reason, str) and reason


# ---------- score_location ----------

def test_location_remote_only_onsite_is_zero():
    s, _ = scorer.score_location(
        _user(remote_preference="remote_only"), _job(is_remote=False))
    assert s == 0.0


def test_location_preferred_exact_match():
    s, _ = scorer.score_location(
        _user(preferred_locations=["Berlin"]), _job(location="Berlin, Germany"))
    assert s == 1.0


def test_location_mismatch_low():
    s, _ = scorer.score_location(
        _user(preferred_locations=["Berlin"]),
        _job(location="Tokyo", is_remote=False))
    assert s == 0.2


# ---------- score_salary ----------

def test_salary_meets_desired():
    s, _ = scorer.score_salary(
        _user(desired_salary_usd=90000),
        _job(salary_min=90000, salary_max=120000, salary_currency="USD",
             salary_period="YEAR"))
    assert s == 1.0


def test_salary_below_desired_is_ratio():
    s, _ = scorer.score_salary(
        _user(desired_salary_usd=100000),
        _job(salary_min=40000, salary_max=50000, salary_currency="USD",
             salary_period="YEAR"))
    assert s == pytest.approx(0.5, abs=1e-6)


def test_salary_unspecified_neutral():
    s, _ = scorer.score_salary(_user(desired_salary_usd=None), _job())
    assert s == 0.7


def test_salary_zero_desired_is_neutral_not_perfect():
    # desired=0 을 '아무 연봉이나 만점(1.0)'으로 보지 않고 미지정(중립 0.7)로 처리
    s, _ = scorer.score_salary(
        _user(desired_salary_usd=0),
        _job(salary_max=40000, salary_currency="USD", salary_period="YEAR"))
    assert s == 0.7


def test_apply_diversity_zero_topk_returns_empty():
    user = _user()
    jobs = [_job(jid=f"t:{i}", company=f"C{i}") for i in range(3)]
    scored = [(j, scorer.score_job(j, user, DEFAULT_WEIGHTS)) for j in jobs]
    assert scorer.apply_diversity(scored, top_k=0) == []
    assert scorer.apply_diversity(scored, top_k=-1) == []


# ---------- score_job: 가중 합산 + 패널티 ----------

def test_score_job_weighted_sum_matches_manual():
    user = _user(needs_visa_sponsorship=True, preferred_locations=["Berlin"],
                 desired_salary_usd=90000, bio="backend")
    job = _job(tags=["python", "django", "aws"], visa_status="sponsors",
               location="Berlin", is_remote=True,
               salary_min=90000, salary_max=120000, salary_currency="USD",
               salary_period="YEAR")
    bd = scorer.score_job(job, user, DEFAULT_WEIGHTS)

    w = DEFAULT_WEIGHTS
    expected_raw = (w.stack * bd.stack + w.visa * bd.visa + w.location * bd.location
                    + w.seniority * bd.seniority + w.salary * bd.salary
                    + w.semantic * bd.semantic)
    assert bd.penalty_applied == 1.0
    assert bd.final_score == pytest.approx(round(expected_raw, 3), abs=2e-3)
    assert bd.semantic == 0.5  # 모킹값


def test_visa_dealbreaker_penalty():
    user = _user(needs_visa_sponsorship=True)
    job = _job(visa_status="no_sponsor")
    bd = scorer.score_job(job, user, DEFAULT_WEIGHTS)
    assert bd.penalty_applied == pytest.approx(0.1)
    assert any("비자" in d for d in bd.deal_breakers)


def test_remote_only_dealbreaker_penalty():
    user = _user(remote_preference="remote_only")
    job = _job(is_remote=False)
    bd = scorer.score_job(job, user, DEFAULT_WEIGHTS)
    assert bd.penalty_applied == pytest.approx(0.2)


def test_excluded_company_zeroes_out():
    user = _user(excluded_companies=["Acme"])
    bd = scorer.score_job(_job(company="Acme"), user, DEFAULT_WEIGHTS)
    assert bd.final_score == 0.0
    assert bd.penalty_applied == 0.0


def test_penalties_compound():
    # 비자(×0.1) + 원격only(×0.2) 가 곱으로 누적 → ×0.02
    user = _user(needs_visa_sponsorship=True, remote_preference="remote_only")
    job = _job(visa_status="no_sponsor", is_remote=False)
    bd = scorer.score_job(job, user, DEFAULT_WEIGHTS)
    assert bd.penalty_applied == pytest.approx(0.02, abs=1e-6)


# ---------- apply_diversity ----------

def test_apply_diversity_caps_per_company():
    user = _user()
    jobs = [_job(jid=f"test:{i}", company="Same") for i in range(5)]
    scored = sorted(
        ((j, scorer.score_job(j, user, DEFAULT_WEIGHTS)) for j in jobs),
        key=lambda x: x[1].final_score, reverse=True)
    chosen = scorer.apply_diversity(scored, top_k=10, max_per_company=2)
    assert len(chosen) == 2


def test_apply_diversity_respects_top_k():
    user = _user()
    jobs = [_job(jid=f"test:{i}", company=f"Co{i}") for i in range(10)]
    scored = sorted(
        ((j, scorer.score_job(j, user, DEFAULT_WEIGHTS)) for j in jobs),
        key=lambda x: x[1].final_score, reverse=True)
    chosen = scorer.apply_diversity(scored, top_k=3, max_per_company=2)
    assert len(chosen) == 3


# ---------- parse_weights ----------

def test_parse_weights_normalizes_to_one():
    w = parse_weights({"stack": 2, "visa": 2, "location": 2, "seniority": 2,
                       "salary": 2, "semantic": 2})
    total = w.stack + w.visa + w.location + w.seniority + w.salary + w.semantic
    assert total == pytest.approx(1.0)


def test_parse_weights_none_returns_default():
    assert parse_weights(None) is DEFAULT_WEIGHTS


def test_parse_weights_rejects_negative():
    # 음수 가중치를 0 으로 막아 정규화 후 차원이 음수가 되지 않게(0~1 보장)
    w = parse_weights({"stack": -1, "visa": 2})
    for dim in (w.stack, w.visa, w.location, w.seniority, w.salary, w.semantic):
        assert dim >= 0.0
    total = w.stack + w.visa + w.location + w.seniority + w.salary + w.semantic
    assert total == pytest.approx(1.0)


# ---------- engine.recommend: 게이트 + 정렬 + 다양성 ----------

def test_recommend_ranks_and_gates():
    user = _user(needs_visa_sponsorship=True, preferred_locations=["Berlin"],
                 desired_salary_usd=90000, excluded_companies=["BadCo"])
    pool = [
        _job(jid="test:good", company="GoodCo", tags=["python", "django", "aws"],
             visa_status="sponsors", location="Berlin", is_remote=True,
             salary_min=95000, salary_max=120000, salary_currency="USD",
             salary_period="YEAR"),
        _job(jid="test:novisa", company="NoVisaCo", tags=["python", "django"],
             visa_status="no_sponsor", location="Berlin"),  # ×0.1 → 게이트 컷
        _job(jid="test:excluded", company="BadCo", tags=["python", "django", "aws"],
             visa_status="sponsors", location="Berlin"),     # ×0.0 → 컷
        _job(jid="test:rust", company="RustCo", tags=["rust", "c++"],
             visa_status="sponsors", is_remote=True),
    ]
    results = asyncio.run(recommend(pool, user, top_k=10, min_score=0.15))
    ids = [r["job_id"] for r in results]

    assert ids[0] == "test:good"               # 완벽 매칭이 1위
    assert "test:excluded" not in ids          # 제외 회사 컷
    assert "test:novisa" not in ids            # 비자 deal-breaker → min_score 컷
    # 내림차순 정렬 보장
    scores = [r["score_breakdown"]["final_score"] for r in results]
    assert scores == sorted(scores, reverse=True)


def test_recommend_empty_pool():
    assert asyncio.run(recommend([], _user())) == []


def test_score_job_handles_none_location_and_company():
    # 외부 소스가 location/company 에 명시적 None 을 넣어도 AttributeError 없이 점수화
    user = _user(preferred_locations=["Berlin"], excluded_companies=["X"])
    job = _job(company=None, location=None, is_remote=False)
    bd = scorer.score_job(job, user, DEFAULT_WEIGHTS)
    assert 0.0 <= bd.final_score <= 1.0


def test_apply_diversity_handles_none_company():
    user = _user()
    jobs = [_job(jid=f"test:{i}", company=None) for i in range(3)]
    scored = [(j, scorer.score_job(j, user, DEFAULT_WEIGHTS)) for j in jobs]
    chosen = scorer.apply_diversity(scored, top_k=10, max_per_company=2)
    assert len(chosen) == 2  # None→"" 로 같은 회사 취급, 다양성 제약 적용
