"""추천 엔진: 후보 수집 → 점수화 → 정렬 → 다양성 → top_k."""
from __future__ import annotations
import asyncio
from typing import Any

from ..models import JobPosting
from .profile import UserProfile, ScoringWeights, parse_weights
from .scorer import score_job, apply_diversity, ScoreBreakdown


async def recommend(
    candidate_pool: list[JobPosting],
    user: UserProfile,
    top_k: int = 10,
    weights: dict | None = None,
    max_per_company: int = 2,
    min_score: float = 0.15,
) -> list[dict[str, Any]]:
    """추천 메인 함수.

    Args:
        candidate_pool: 후보 공고 리스트 (이미 enrich 된 상태)
        user: 사용자 프로필
        top_k: 최종 반환할 공고 수
        weights: 점수 가중치 커스터마이즈 (선택)
        max_per_company: 같은 회사에서 최대 몇 개까지 추천할지
        min_score: 이 점수 미만은 deal-breaker 가 있어도 추천 안 함

    Returns:
        추천 공고 리스트 (점수 내림차순). 각 항목에 score breakdown 과 reasons 포함.
    """
    w = parse_weights(weights)

    # 1. 모든 공고 점수화 (CPU-bound 이지만 임베딩이 I/O 처럼 무거우므로
    #    sentence-transformers 가 내부적으로 batch 처리하도록 둠)
    scored: list[tuple[JobPosting, ScoreBreakdown]] = []
    for job in candidate_pool:
        breakdown = score_job(job, user, w)
        if breakdown.final_score >= min_score:
            scored.append((job, breakdown))

    # 2. 점수 내림차순 정렬
    scored.sort(key=lambda x: x[1].final_score, reverse=True)

    # 3. 다양성 제약
    selected = apply_diversity(scored, top_k=top_k, max_per_company=max_per_company)

    # 4. 출력 형식 (description 은 미리보기만)
    results = []
    for job, breakdown in selected:
        d = job.to_dict()
        d["description_preview"] = d.pop("description", "")[:500]
        d["score_breakdown"] = breakdown.to_dict()
        results.append(d)

    return results
