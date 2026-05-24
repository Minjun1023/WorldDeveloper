"""ultrawork: 채용 워크플로우 통합 tool.

oh-my-openagent (omo) 의 `ultrawork` 패턴을 채용 도메인으로 옮긴 것.
한 번의 호출로 검색 → 추천 → 회사 인텔 보강 → 인사이트 집계 → 다음 행동 제안까지 chain.

omo 의 코드 작업용 ultrawork 와 도메인이 다르므로 동일 이름 사용에 충돌 없음.

설계 원칙:
- 외부 API 호출 폭증 방지: enrichment 는 상위 enrich_top 개만
- 병렬화: 회사 intel 호출은 asyncio.gather
- 실패 격리: 한 회사 intel 이 실패해도 전체 결과는 반환
- 호출 측 (server.py) 이 candidate pool 을 모아 넘기는 책임 분리 (circular import 방지)
"""
from __future__ import annotations
import asyncio
from collections import Counter
from typing import Any

from . import intel
from .models import JobPosting
from .recommender import engine as recommender_engine
from .recommender.profile import UserProfile


async def run(
    user: UserProfile,
    candidates: list[JobPosting],
    top_k: int = 10,
    enrich_top: int = 3,
    include_intel: bool = True,
    intel_months_back: int = 6,
    weights: dict | None = None,
    max_per_company: int = 2,
) -> dict[str, Any]:
    """채용 워크플로우 ultrawork 실행.

    Args:
        user: 사용자 프로필
        candidates: 점수화 대상 공고 풀 (호출 측에서 수집)
        top_k: 추천 받을 공고 수
        enrich_top: 상위 몇 개 회사에 인텔 보강할지
        include_intel: HN 인텔 호출 여부 (외부 API 호출 발생)
        intel_months_back: 인텔 조회 기간
        weights: 점수 가중치 커스터마이즈
        max_per_company: 같은 회사 최대 N개 (다양성 제약)

    Returns:
        {
          'workflow': 'ultrawork',
          'profile_summary': ...,
          'recommendations': [top_k],
          'enriched_top_picks': [enrich_top with intel],
          'aggregate_insights': { visa_distribution, top_companies, ... },
          'next_actions': [...]
        }
    """
    recommendations = await recommender_engine.recommend(
        candidate_pool=candidates,
        user=user,
        top_k=top_k,
        weights=weights,
        max_per_company=max_per_company,
    )

    top_picks = recommendations[: max(0, enrich_top)]

    # 병렬 enrichment (회사 인텔)
    intel_by_company: dict[str, Any] = {}
    if include_intel and top_picks:
        unique_companies: list[str] = []
        seen: set[str] = set()
        for rec in top_picks:
            company = (rec.get("company") or "").lower()
            if company and company not in seen:
                seen.add(company)
                unique_companies.append(company)

        if unique_companies:
            tasks = [intel.get_company_intel(c, months_back=intel_months_back) for c in unique_companies]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for company, res in zip(unique_companies, results):
                if isinstance(res, Exception):
                    intel_by_company[company] = {"error": f"{type(res).__name__}: {res}"}
                else:
                    intel_by_company[company] = res

    # 인사이트 집계 (전체 추천 기준)
    visa_counts: Counter = Counter()
    company_counts: Counter = Counter()
    remote_counts: Counter = Counter()
    for rec in recommendations:
        visa_counts[rec.get("visa_status") or "unclear"] += 1
        company_counts[rec.get("company") or ""] += 1
        remote_counts["remote" if rec.get("is_remote") else "onsite"] += 1

    # 다음 행동 제안 (사용자 상태 기반)
    next_actions: list[str] = []
    if not user.resume_text:
        next_actions.append(
            "이력서 텍스트를 프로필에 추가하면 `optimize_resume_for_job` 으로 공고별 키워드 최적화 가능."
        )
    next_actions.extend([
        f"상위 추천 {len(top_picks)}개 중 가장 관심 있는 공고는 `track_application(status='interested')` 로 추적 시작.",
        "지원 후 `track_application(status='applied')` 로 상태 업데이트.",
        "인터뷰 일정 잡히면 `generate_interview_prep(job_id, stage='phone_screen'|'take_home'|'onsite'|...)` 호출.",
        "거절 받으면 `find_recovery_path(rejected_job_id, reason='...')` 로 비슷한 회사 탐색 + 다음 단계.",
    ])
    if user.needs_visa_sponsorship and visa_counts.get("sponsors", 0) == 0:
        next_actions.insert(0,
            "비자 스폰서십 필요인데 명시 공고 0건. 검색 범위를 넓히거나 `find_visa_sponsors(query='...')` 직접 호출 권장."
        )

    enriched_top_picks: list[dict[str, Any]] = []
    for i, rec in enumerate(top_picks):
        company = (rec.get("company") or "").lower()
        company_intel = intel_by_company.get(company) if include_intel else None
        enriched_top_picks.append({
            "rank": i + 1,
            "job_id": rec.get("job_id"),
            "title": rec.get("title"),
            "company": rec.get("company"),
            "location": rec.get("location"),
            "is_remote": rec.get("is_remote"),
            "visa_status": rec.get("visa_status"),
            "visa_evidence": rec.get("visa_evidence"),
            "apply_url": rec.get("apply_url"),
            "score_breakdown": rec.get("score_breakdown"),
            "company_intel": company_intel,
        })

    return {
        "workflow": "ultrawork",
        "profile_summary": {
            "skills_count": len(user.skills),
            "seniority": user.seniority,
            "years_experience": user.years_experience,
            "needs_visa_sponsorship": user.needs_visa_sponsorship,
            "preferred_locations": user.preferred_locations,
            "remote_preference": user.remote_preference,
            "has_resume_text": bool(user.resume_text),
            "has_bio": bool(user.bio),
        },
        "total_candidates": len(candidates),
        "recommendations": recommendations,
        "enriched_top_picks": enriched_top_picks,
        "aggregate_insights": {
            "visa_distribution": dict(visa_counts),
            "remote_distribution": dict(remote_counts),
            "top_companies": company_counts.most_common(5),
            "candidate_pool_size": len(candidates),
            "recommendations_returned": len(recommendations),
            "intel_fetched": list(intel_by_company.keys()) if include_intel else [],
        },
        "next_actions": next_actions,
        "note": (
            "ultrawork 는 단일 호출로 검색→추천→인텔→다음 행동까지 끝내는 메타 tool 입니다 "
            "(omo 패턴 차용). 더 깊이 들어가려면 enriched_top_picks 의 job_id 로 "
            "prepare_application_kit / generate_interview_prep 등을 개별 호출하세요."
        ),
    }
