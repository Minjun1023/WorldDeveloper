"""거절 통보 받았을 때 다음 단계 자동 제안.

흐름:
1) tracker 에서 거절된 공고의 회사를 찾는다 (registry 에서 태그 룩업)
2) 같은 태그를 가진 다른 회사들을 추천
3) 사용자 통계: 전체 지원/거절률, 거절 자주 발생하는 단계
4) 다음 행동 체크리스트 + 따뜻한 마무리 멘트
"""
from __future__ import annotations
from datetime import datetime
from typing import Any

from . import tracker
from . import registry


def _stage_breakdown(apps: list[dict]) -> dict[str, int]:
    """지원 리스트에서 단계별 카운트."""
    out: dict[str, int] = {}
    for a in apps:
        out[a["status"]] = out.get(a["status"], 0) + 1
    return out


def recover(rejected_job_id: str, reason: str = "", mark_rejected: bool = True) -> dict[str, Any]:
    """거절된 공고에 대해 회복 액션 키트 생성.

    Args:
        rejected_job_id: tracker 에 있어야 하는 job_id
        reason: 사용자가 입력한 거절 사유 (선택)
        mark_rejected: True 면 tracker 상태를 'rejected' 로 업데이트
    """
    history = tracker.get_application_history(rejected_job_id)
    app = history.get("application") if isinstance(history, dict) else None
    if not app:
        return {
            "error": f"tracker 에 등록되지 않은 job_id: {rejected_job_id}. "
                     "먼저 track_application 으로 등록하세요.",
        }

    # 1) 상태 업데이트 (선택)
    if mark_rejected:
        tracker.track(
            job_id=rejected_job_id,
            status="rejected",
            notes=f"reason: {reason}" if reason else "rejected",
        )

    # 2) 비슷한 회사 찾기 — registry 에서 같은 태그
    company_name = (app.get("company") or "").lower()
    company_info = registry.resolve(company_name)
    similar_companies: list[dict] = []
    shared_tags: list[str] = []
    if company_info:
        shared_tags = company_info.get("tags", []) or []
        if shared_tags:
            candidates = registry.search_by_tag(shared_tags)
            # 자기 자신 제외
            similar_companies = [
                c for c in candidates
                if c.get("name", "").lower() != company_name
            ][:8]

    # 3) 사용자 전체 통계
    all_apps = tracker.list_applications()
    rejected_count = sum(1 for a in all_apps if a["status"] == "rejected")
    total = len(all_apps)
    rejection_rate = round(rejected_count / total, 2) if total else 0.0

    # 4) 다음 행동
    actions = [
        "거절 통보의 구체적 사유를 (있다면) tracker notes 에 기록 → 패턴 파악에 도움",
        "비슷한 회사들 중 하나를 골라 find_companies + list_company_jobs 로 공고 탐색",
        "지난 인터뷰에서 막혔던 기술 주제가 있다면 generate_interview_prep 으로 다시 준비",
        "이력서가 이 공고와 매칭이 약했다면 다른 공고용으로 optimize_resume_for_job 재호출",
        "회복에 시간 필요. 며칠 쉬고 돌아오는 것도 전략 — 거절률은 평균적인 일.",
    ]

    if rejected_count >= 3:
        actions.insert(0,
            f"누적 거절 {rejected_count}건. recommend_jobs 의 use_learned_weights=True 로 호출해 "
            "지금까지의 피드백 기반으로 추천 가중치를 재조정해보세요.")

    # 5) 따뜻한 멘트 (사실 기반)
    encouragement = (
        f"한 곳에서 잘 안 풀린 거지 사용자의 가치가 떨어진 게 아닙니다. "
        f"여기까지 지원 {total}건, 면접 단계 {sum(1 for a in all_apps if a['status'] in ['phone_screen','take_home','onsite'])}건, "
        f"오퍼 {sum(1 for a in all_apps if a['status'] in ['offer','accepted'])}건 — 데이터로 보면 진행 중입니다."
    )

    return {
        "rejected_job_id": rejected_job_id,
        "job_title": app.get("title", ""),
        "company": app.get("company", ""),
        "reason_logged": reason or None,
        "tracker_updated": mark_rejected,
        "shared_tags": shared_tags,
        "similar_companies": similar_companies,
        "stats": {
            "total_applications": total,
            "rejected_count": rejected_count,
            "rejection_rate": rejection_rate,
            "stage_breakdown": _stage_breakdown(all_apps),
        },
        "next_actions": actions,
        "encouragement": encouragement,
        "generated_at": datetime.utcnow().isoformat(),
    }
