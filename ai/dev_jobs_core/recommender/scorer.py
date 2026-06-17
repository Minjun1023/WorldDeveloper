"""채용 공고 점수화 엔진.

각 차원별 점수 (0~1) + 가중합 + 패널티 + 설명용 reasons 생성.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

from ..analyzers import stack as stack_analyzer
from ..analyzers.salary import _to_usd_year
from ..models import JobPosting
from . import embeddings
from .profile import ScoringWeights, UserProfile
from .seniority import detect_seniority, seniority_fit_score


@dataclass
class ScoreBreakdown:
    """단일 공고의 점수 세부 내역. 디버깅과 설명에 사용."""
    final_score: float
    stack: float
    visa: float
    location: float
    seniority: float
    salary: float
    semantic: float
    penalty_applied: float = 1.0    # 1.0 = no penalty, 0.x = penalized
    reasons: list[str] = None       # 추천 이유 (긍정)
    deal_breakers: list[str] = None # 비추천 이유 (강한 부정)

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["reasons"] = self.reasons or []
        d["deal_breakers"] = self.deal_breakers or []
        return d


# --- 차원별 점수 함수 ---

def score_stack(user_skills: list[str], job: JobPosting) -> tuple[float, list[str], list[str]]:
    """스택 매칭. (점수, matched, missing) 반환."""
    user_set = {s.lower() for s in user_skills}
    # 공고 태그 + description 에서 추출된 기술
    job_tags = {t.lower() for t in (job.tags or [])}
    job_stack_from_desc = set(stack_analyzer.extract_tech(job.description))
    job_required = job_tags | job_stack_from_desc

    if not job_required:
        return 0.25, [], []  # 스택 미확인 공고는 강등(중립 0.5 → 0.25): 비자/연봉만으로 상위 노출 방지

    matched = sorted(user_set & job_required)
    missing = sorted(job_required - user_set)

    # 매칭률을 기본으로 하되, 매칭된 절대 개수도 보너스 (최소 3개 매칭 = 만점에 가깝게)
    ratio = len(matched) / max(len(job_required), 1)
    abs_bonus = min(1.0, len(matched) / 3)

    score = 0.6 * ratio + 0.4 * abs_bonus
    return min(1.0, score), matched, missing


def score_visa(user: UserProfile, job: JobPosting) -> tuple[float, str]:
    """비자 적합도. (점수, 사유) 반환."""
    if not user.needs_visa_sponsorship:
        return 1.0, "비자 스폰서십 불필요"

    status_score = {
        "sponsors": 1.0,
        "unclear": 0.4,    # 가능성 있음, evidence 부족
        "no_sponsor": 0.0,
    }
    score = status_score.get(job.visa_status, 0.4)
    reason = {
        "sponsors": "비자 스폰서십 명시",
        "unclear": "비자 정책 미언급 (별도 확인 필요)",
        "no_sponsor": "비자 스폰서십 불가 명시",
    }[job.visa_status]
    return score, reason


def score_location(user: UserProfile, job: JobPosting) -> tuple[float, str]:
    """지역 매칭."""
    # 원격 선호 우선 처리
    if user.remote_preference == "remote_only":
        if job.is_remote:
            return 1.0, "원격 근무 가능"
        return 0.0, "원격만 희망하는데 온사이트 공고"

    if not user.preferred_locations:
        return 0.7, "지역 선호 미지정 (중립)"

    job_loc_lower = job.location.lower()

    # 원격이고 사용자가 원격을 선호 목록에 포함시켰으면 매칭
    if job.is_remote and any("remote" in loc.lower() for loc in user.preferred_locations):
        return 1.0, "원격 근무 가능 (선호 목록과 일치)"

    for loc in user.preferred_locations:
        if loc.lower() in job_loc_lower:
            return 1.0, f"선호 지역 '{loc}' 일치"

    # 같은 국가지만 다른 도시 같은 경우 부분 점수
    # (간단 처리: 사용자 location 의 한 단어라도 공고에 있으면)
    for loc in user.preferred_locations:
        for word in loc.split():
            if len(word) >= 3 and word.lower() in job_loc_lower:
                return 0.5, f"선호 지역과 부분 일치 ('{word}')"

    if job.is_remote and user.remote_preference != "remote_only":
        return 0.7, "원격 근무 가능 (하이브리드/유연성)"

    return 0.2, f"선호 지역과 불일치 (공고: {job.location or '미지정'})"


def score_seniority(user: UserProfile, job: JobPosting) -> tuple[float, str]:
    """시니어리티 매칭."""
    job_level = detect_seniority(job.title, job.description)
    fit = seniority_fit_score(user.seniority, job_level)
    if job_level == "unspecified":
        reason = "공고에 시니어리티 미명시"
    elif job_level == user.seniority.lower():
        reason = f"시니어리티 정확히 일치 ({job_level})"
    else:
        reason = f"사용자 {user.seniority} vs 공고 {job_level}"
    return fit, reason


def score_salary(user: UserProfile, job: JobPosting) -> tuple[float, str]:
    """연봉 만족도. 공고 연봉이 사용자 희망 이상이면 1.0."""
    if user.desired_salary_usd is None:
        return 0.7, "연봉 희망 미지정 (중립)"

    if job.salary_min is None and job.salary_max is None:
        return 0.6, "공고에 연봉 미공개 (중립)"

    # 공고 연봉을 USD/year 로 정규화
    raw_max = job.salary_max or job.salary_min or 0
    raw_min = job.salary_min or job.salary_max or 0
    max_usd = _to_usd_year(raw_max, job.salary_currency or "USD", job.salary_period or "YEAR")
    min_usd = _to_usd_year(raw_min, job.salary_currency or "USD", job.salary_period or "YEAR")

    if not max_usd:
        return 0.6, "연봉 정규화 실패"

    if max_usd >= user.desired_salary_usd:
        # 희망 이상이면 만족, 큰 폭으로 넘으면 만점 유지
        return 1.0, f"연봉 ${int(min_usd or max_usd):,}–${int(max_usd):,} (희망 이상)"
    # 희망 미만이면 비율로 점수
    ratio = max_usd / user.desired_salary_usd
    return max(0.0, ratio), f"연봉 최대 ${int(max_usd):,} (희망 ${user.desired_salary_usd:,} 미달)"


def score_semantic(user: UserProfile, job: JobPosting) -> tuple[float, str]:
    """이력서/bio 와 공고 description 의 의미 유사도."""
    if not embeddings.is_available():
        return 0.0, "임베딩 모델 미사용"

    profile_text = " ".join(filter(None, [user.bio, user.resume_text]))
    if not profile_text:
        return 0.5, "프로필 텍스트 없음 (중립)"

    job_text = f"{job.title} {job.description}"
    sim = embeddings.cosine_similarity(profile_text, job_text)
    return sim, f"의미 유사도 {sim:.2f}"


# --- 전체 점수 + 다양성 제약 ---

def score_job(
    job: JobPosting,
    user: UserProfile,
    weights: ScoringWeights,
) -> ScoreBreakdown:
    """단일 공고에 대해 전체 점수와 설명 생성."""
    stack_s, matched, missing = score_stack(user.skills, job)
    visa_s, visa_reason = score_visa(user, job)
    loc_s, loc_reason = score_location(user, job)
    sen_s, sen_reason = score_seniority(user, job)
    sal_s, sal_reason = score_salary(user, job)
    sem_s, sem_reason = score_semantic(user, job)

    raw = (
        weights.stack * stack_s
        + weights.visa * visa_s
        + weights.location * loc_s
        + weights.seniority * sen_s
        + weights.salary * sal_s
        + weights.semantic * sem_s
    )

    # --- 패널티 (deal-breakers) ---
    penalty = 1.0
    deal_breakers: list[str] = []

    if user.needs_visa_sponsorship and job.visa_status == "no_sponsor":
        penalty *= 0.1
        deal_breakers.append("비자 스폰서십 불가 (사용자 비자 필요)")

    if user.remote_preference == "remote_only" and not job.is_remote:
        penalty *= 0.2
        deal_breakers.append("온사이트 공고 (사용자 원격 only)")

    if any(job.company.lower() == c.lower() for c in user.excluded_companies):
        penalty = 0.0
        deal_breakers.append(f"제외 회사 ({job.company})")

    final = raw * penalty

    # --- 긍정 이유 (reasons) ---
    reasons: list[str] = []
    if stack_s >= 0.7:
        reasons.append(f"스택 매칭 {int(stack_s*100)}% ({', '.join(matched[:5])})")
    if visa_s == 1.0 and user.needs_visa_sponsorship:
        reasons.append(visa_reason)
    if loc_s == 1.0:
        reasons.append(loc_reason)
    if sen_s >= 0.9:
        reasons.append(sen_reason)
    if sal_s == 1.0 and user.desired_salary_usd:
        reasons.append(sal_reason)
    if sem_s >= 0.5:
        reasons.append(sem_reason)

    return ScoreBreakdown(
        final_score=round(final, 3),
        stack=round(stack_s, 3),
        visa=round(visa_s, 3),
        location=round(loc_s, 3),
        seniority=round(sen_s, 3),
        salary=round(sal_s, 3),
        semantic=round(sem_s, 3),
        penalty_applied=round(penalty, 3),
        reasons=reasons,
        deal_breakers=deal_breakers,
    )


def apply_diversity(
    scored: list[tuple[JobPosting, ScoreBreakdown]],
    top_k: int,
    max_per_company: int = 2,
) -> list[tuple[JobPosting, ScoreBreakdown]]:
    """다양성 제약: 같은 회사 공고가 상위에 몰리는 것 방지.

    이미 score 내림차순으로 정렬된 리스트를 받는다고 가정.
    """
    from collections import Counter
    chosen: list[tuple[JobPosting, ScoreBreakdown]] = []
    company_count: Counter = Counter()

    for job, breakdown in scored:
        company = job.company.lower().strip()
        if company_count[company] >= max_per_company:
            continue
        chosen.append((job, breakdown))
        company_count[company] += 1
        if len(chosen) >= top_k:
            break
    return chosen
