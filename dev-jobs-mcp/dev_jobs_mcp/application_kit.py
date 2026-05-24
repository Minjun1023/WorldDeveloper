"""Application Kit: 특정 공고에 지원하기 위한 모든 정보를 한 번에 모은다.

여러 모듈을 조합:
- 공고 상세 (server._get_job_details_internal)
- 비자 분석 (analyzers.visa)
- 스택 갭 분석 (analyzers.stack)
- 회사 정보 (intel.get_company_intel)
- 추적 상태 (tracker.get_application_history)

Claude 가 이 결과를 받아 자연어로 맞춤 커버레터/talking points 를 작성할 수 있게 설계.
"""
from __future__ import annotations
from typing import Any
from .models import JobPosting
from .analyzers import stack as stack_analyzer
from .analyzers.visa import classify_visa
from .intel import get_company_intel
from .tracker import get_application_history


async def build_kit(
    job: JobPosting,
    resume_text: str = "",
    user_bio: str = "",
) -> dict[str, Any]:
    """공고 + 이력서로 지원 준비 키트 생성.

    Args:
        job: 이미 enrich 된 JobPosting (visa_status 등 포함)
        resume_text: 이력서 전문 (스킬 갭 분석용)
        user_bio: 짧은 자기소개 (커버레터 talking points 보강)

    Returns:
        Claude 가 자연어로 응답을 작성하기 좋게 구조화된 정보 다발.
    """
    # 1) 공고 핵심 추출
    job_essentials = {
        "job_id": job.job_id,
        "title": job.title,
        "company": job.company,
        "location": job.location,
        "is_remote": job.is_remote,
        "employment_type": job.employment_type,
        "apply_url": job.apply_url,
        "posted_at": job.posted_at,
        "salary": {
            "min": job.salary_min,
            "max": job.salary_max,
            "currency": job.salary_currency,
            "period": job.salary_period,
        },
    }

    # 2) 비자 분석 (job 이 이미 enrich 됐다면 그대로, 안 됐으면 새로 분석)
    visa_section = {
        "status": job.visa_status,
        "evidence": job.visa_evidence,
        "interpretation": _interpret_visa(job.visa_status),
    }

    # 3) 스킬 매칭 (이력서가 있을 때만)
    skill_section: dict[str, Any]
    if resume_text:
        match = stack_analyzer.match_resume(resume_text, job.description)
        skill_section = {
            "required_by_job": match["job_requires"],
            "you_have": match["matched"],
            "missing": match["missing"],
            "your_extras": match["resume_extras"],
            "match_ratio": match["match_ratio"],
            "gap_severity": _gap_severity(match["match_ratio"]),
        }
    else:
        skill_section = {
            "note": "이력서가 제공되지 않아 스킬 매칭 분석 생략",
            "required_by_job": stack_analyzer.extract_tech(job.description),
        }

    # 4) 회사 정보 (HN 언급 + 레지스트리)
    try:
        company_intel = await get_company_intel(job.company, months_back=12)
    except Exception as e:
        company_intel = {"error": str(e), "note": "회사 정보 조회 실패"}

    # 5) 이전 지원 기록 (이미 트래킹 중인 공고인지)
    history = get_application_history(job.job_id)
    tracking_section = (
        history if "error" not in history
        else {"currently_tracked": False, "note": "아직 추적 중이 아님"}
    )

    # 6) Talking points 생성 (커버레터 작성용 단서)
    talking_points = _generate_talking_points(
        job=job,
        skill_section=skill_section,
        user_bio=user_bio,
    )

    return {
        "job": job_essentials,
        "description_full": job.description,
        "visa": visa_section,
        "skills": skill_section,
        "company": company_intel,
        "tracking": tracking_section,
        "talking_points": talking_points,
        "next_steps_suggestion": _suggest_next_steps(visa_section, skill_section, tracking_section),
        "_claude_instructions": (
            "위 데이터를 종합해 사용자에게 다음을 자연어로 제공할 수 있다: "
            "(1) 이 공고가 사용자에게 얼마나 맞는지 한 줄 요약, "
            "(2) 비자 상황 해석, "
            "(3) 스킬 갭과 보완 전략, "
            "(4) 회사 정보 (HN 언급에서 트렌드/이슈 추출), "
            "(5) 커버레터 초안 (talking_points 기반), "
            "(6) 인터뷰 예상 질문 (직무/스킬 기반)."
        ),
    }


def _interpret_visa(status: str) -> str:
    return {
        "sponsors": "비자 스폰서십 명시. 한국에서 직접 지원 가능성 높음.",
        "no_sponsor": "비자 스폰서십 불가 명시. 현재 거주국 작업권 없으면 지원 어려움.",
        "unclear": "비자 정책 미명시. 지원 전 채용 담당자에게 직접 문의 필요.",
    }.get(status, "비자 상태 불명")


def _gap_severity(ratio: float | None) -> str:
    if ratio is None:
        return "unknown"
    if ratio >= 0.7:
        return "low — 스킬 갭이 작아 지원 적극 권장"
    if ratio >= 0.4:
        return "medium — 일부 스킬 보완하면 충분히 경쟁력 있음"
    return "high — 스킬 갭이 크므로 학습 후 지원 권장"


def _generate_talking_points(job: JobPosting, skill_section: dict, user_bio: str) -> list[str]:
    """커버레터 작성에 쓸 만한 단서들."""
    points = []
    matched = skill_section.get("you_have", []) if "you_have" in skill_section else []
    if matched:
        top3 = matched[:3]
        points.append(
            f"이력서에 명시된 {', '.join(top3)} 경험이 공고 핵심 요건과 정확히 일치 — "
            "구체 프로젝트 사례로 어필 가능."
        )
    extras = skill_section.get("your_extras", [])
    if extras:
        points.append(
            f"공고에 직접 언급되지 않은 {', '.join(extras[:3])} 도 보유 — "
            "팀에 추가 가치로 제시 가능."
        )
    missing = skill_section.get("missing", [])
    if missing:
        points.append(
            f"부족한 부분 ({', '.join(missing[:3])}) 은 학습 의지와 인접 경험으로 보완 — "
            "커버레터에서 어떻게 빠르게 배울지 구체적으로 설명할 것."
        )
    if job.is_remote:
        points.append("원격 근무 공고 — 자기주도성, 비동기 커뮤니케이션 경험 강조.")
    if user_bio:
        points.append(f"사용자 bio 활용: '{user_bio}' — 회사 미션과의 연결고리 찾아 부각.")
    return points


def _suggest_next_steps(visa: dict, skills: dict, tracking: dict) -> list[str]:
    """추천 다음 행동 리스트."""
    steps = []

    if tracking.get("currently_tracked"):
        current_status = tracking.get("application", {}).get("status")
        steps.append(f"이미 추적 중 (상태: {current_status}). track_application 으로 상태 업데이트 가능.")
    else:
        steps.append("track_application(job_id, status='interested') 로 추적 시작 권장.")

    if visa.get("status") == "unclear":
        steps.append("비자 스폰서십 여부를 채용 담당자에게 이메일로 먼저 확인할 것.")
    elif visa.get("status") == "no_sponsor":
        steps.append("비자 불가 공고이므로 다른 공고를 우선 검토 권장.")

    if skills.get("gap_severity", "").startswith("high"):
        steps.append("스킬 갭이 크므로 부족한 핵심 기술을 1~2개 학습 후 지원하는 게 합격률 ↑")
    elif skills.get("gap_severity", "").startswith("low"):
        steps.append("스킬 매칭이 좋음. 빠르게 커버레터 작성 후 지원할 것.")

    return steps
