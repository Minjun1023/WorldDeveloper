"""해외 개발자 채용 공고 MCP 서버 - 메인 엔트리포인트.

Tools:
- search_dev_jobs       : 멀티 소스 통합 검색
- get_job_details       : 단일 공고 상세 + 비자/스택 분석
- list_company_jobs     : 특정 회사의 모든 오픈 포지션 (Greenhouse/Lever)
- find_visa_sponsors    : 비자 스폰서십 명시 공고만
- match_resume_to_job   : 이력서-공고 스택 매칭
- check_new_jobs        : 마지막 체크 이후 신규 공고
- get_salary_insights   : 직무/지역별 연봉 통계
- recommend_jobs        : 사용자 프로필 기반 개인화 추천 (v2: 규칙 + 임베딩)
"""
from __future__ import annotations
import asyncio
from typing import Any
from mcp.server.fastmcp import FastMCP

from .models import JobPosting
from .sources import remoteok, arbeitnow, greenhouse, lever, ashby, jsearch
from .analyzers import visa as visa_analyzer
from .analyzers import stack as stack_analyzer
from .analyzers import salary as salary_analyzer
from . import storage
from . import registry
from . import tracker
from . import intel
from . import application_kit as app_kit
from . import rss_monitor
from . import interview_prep as interview_prep_mod
from . import feedback as feedback_mod
from . import resume_optimizer
from . import rejection_recovery
from . import ultrawork as ultrawork_mod
from . import disciplines as disciplines_mod
from .recommender.profile import UserProfile
from .recommender import engine as recommender_engine

mcp = FastMCP("dev-jobs")


# ---------- 내부 헬퍼 ----------

def _enrich(job: JobPosting) -> JobPosting:
    """공고에 비자 분석 결과 등을 채워넣는다."""
    status, evidence = visa_analyzer.classify_visa(job.description)
    job.visa_status = status
    job.visa_evidence = evidence
    if not job.tags:
        job.tags = stack_analyzer.extract_tech(job.description)
    return job


def _dedupe(jobs: list[JobPosting]) -> list[JobPosting]:
    """소스가 달라도 같은 회사+제목인 공고는 중복으로 간주해 1개만 유지."""
    seen: set[tuple[str, str]] = set()
    out: list[JobPosting] = []
    for j in jobs:
        key = (j.company.lower().strip(), j.title.lower().strip())
        if key in seen:
            continue
        seen.add(key)
        out.append(j)
    return out


async def _multi_source_search(
    query: str,
    location: str = "",
    remote_only: bool = False,
    limit_per_source: int = 30,
) -> list[JobPosting]:
    """모든 활성 소스에서 병렬로 검색."""
    tasks = [
        remoteok.fetch(query=query, limit=limit_per_source),
        arbeitnow.fetch(query=query, limit=limit_per_source),
    ]
    if jsearch.is_enabled():
        tasks.append(jsearch.fetch(
            query=query, location=location, remote_only=remote_only, limit=limit_per_source,
        ))

    results = await asyncio.gather(*tasks, return_exceptions=True)

    merged: list[JobPosting] = []
    for r in results:
        if isinstance(r, Exception):
            # 한 소스가 실패해도 나머지는 계속 진행
            continue
        merged.extend(r)

    # 원격 only / location 추가 필터
    if remote_only:
        merged = [j for j in merged if j.is_remote]
    if location:
        loc_lower = location.lower()
        merged = [j for j in merged if loc_lower in j.location.lower() or j.is_remote]

    merged = _dedupe(merged)
    return [_enrich(j) for j in merged]


# ---------- MCP Tools ----------

@mcp.tool()
async def search_dev_jobs(
    query: str,
    location: str = "",
    remote_only: bool = False,
    visa_sponsorship: str = "any",
    limit: int = 30,
) -> list[dict[str, Any]]:
    """해외 개발자 채용 공고를 여러 소스에서 통합 검색합니다.

    소스: RemoteOK, Arbeitnow (+ JSearch RAPIDAPI_KEY 가 있는 경우)

    Args:
        query: 직무/기술 키워드 (예: "python backend", "react senior", "ml engineer")
        location: 도시/국가 (예: "Berlin", "Germany", "London"). 비워두면 전 지역.
        remote_only: 원격 근무 공고만 필터링
        visa_sponsorship: "any" / "sponsors_only" / "exclude_no_sponsor"
        limit: 최대 결과 수

    Returns:
        공고 리스트. 각 항목에 비자 분석 결과(visa_status)와 추출된 기술 스택(tags) 포함.
    """
    jobs = await _multi_source_search(query, location, remote_only)

    if visa_sponsorship == "sponsors_only":
        jobs = [j for j in jobs if j.visa_status == "sponsors"]
    elif visa_sponsorship == "exclude_no_sponsor":
        jobs = [j for j in jobs if j.visa_status != "no_sponsor"]

    # 응답에서 description 은 미리보기만 (전체는 get_job_details 로)
    results = []
    for j in jobs[:limit]:
        d = j.to_dict()
        d["description_preview"] = d.pop("description", "")[:400]
        results.append(d)
    return results


@mcp.tool()
async def get_job_details(job_id: str) -> dict[str, Any]:
    """공고 ID로 전체 상세 정보를 가져옵니다.

    job_id 는 search_dev_jobs / list_company_jobs 결과의 job_id 값을 그대로 사용.
    형식: "{source}:{native_id}" 또는 "{source}:{company}:{native_id}"
    """
    parts = job_id.split(":", 2)
    if len(parts) < 2:
        return {"error": f"잘못된 job_id 형식: {job_id}"}

    source = parts[0]

    # source 별로 다시 가져오는 대신, 가장 최근 검색 결과 캐시를 두는 게 이상적이지만
    # 단순화를 위해 회사별 소스(greenhouse/lever) 는 직접 재조회, 그 외는 검색 다시 실행.
    if source == "greenhouse" and len(parts) == 3:
        company, native = parts[1], parts[2]
        jobs = await greenhouse.fetch(company=company, limit=500)
        for j in jobs:
            if j.job_id == job_id:
                return _enrich(j).to_dict()
        return {"error": f"공고를 찾지 못했습니다: {job_id}"}

    if source == "lever" and len(parts) == 3:
        company, native = parts[1], parts[2]
        jobs = await lever.fetch(company=company, limit=500)
        for j in jobs:
            if j.job_id == job_id:
                return _enrich(j).to_dict()
        return {"error": f"공고를 찾지 못했습니다: {job_id}"}

    return {
        "error": (
            f"{source} 소스는 직접 상세조회를 지원하지 않습니다. "
            "search_dev_jobs 결과의 description_preview 와 apply_url 을 사용하세요."
        )
    }


@mcp.tool()
async def list_company_jobs(
    company: str,
    ats: str = "auto",
    query: str = "",
    visa_sponsorship: str = "any",
) -> list[dict[str, Any]]:
    """특정 회사의 모든 오픈 포지션을 직접 가져옵니다 (가장 정확하고 빠름).

    Args:
        company: 회사의 ATS board token (예: "stripe", "airbnb", "notion")
                 회사 채용 페이지 URL 에서 확인 가능.
                 - Greenhouse: boards.greenhouse.io/{company}
                 - Lever: jobs.lever.co/{company}
        ats: "auto" / "greenhouse" / "lever". auto 면 둘 다 시도.
        query: 직무 필터 (선택)
        visa_sponsorship: "any" / "sponsors_only" / "exclude_no_sponsor"

    Returns:
        해당 회사의 공고 리스트. 없으면 빈 리스트 (회사가 다른 ATS 를 쓸 수 있음).
    """
    jobs: list[JobPosting] = []

    # 레지스트리에서 회사 정보 확인 (있으면 정확한 ATS 사용)
    resolved = registry.resolve(company)
    if resolved and ats == "auto":
        ats = resolved["ats"]
        company = resolved["token"]

    if ats in ("auto", "greenhouse"):
        try:
            jobs.extend(await greenhouse.fetch(company=company, query=query))
        except Exception:
            pass

    if ats in ("auto", "lever") and not jobs:
        try:
            jobs.extend(await lever.fetch(company=company, query=query))
        except Exception:
            pass

    if ats in ("auto", "ashby") and not jobs:
        try:
            jobs.extend(await ashby.fetch(company=company, query=query))
        except Exception:
            pass

    jobs = [_enrich(j) for j in jobs]

    if visa_sponsorship == "sponsors_only":
        jobs = [j for j in jobs if j.visa_status == "sponsors"]
    elif visa_sponsorship == "exclude_no_sponsor":
        jobs = [j for j in jobs if j.visa_status != "no_sponsor"]

    return [
        {**j.to_dict(), "description_preview": j.description[:400]}
        for j in jobs
    ]


@mcp.tool()
async def find_visa_sponsors(
    query: str,
    location: str = "",
    limit: int = 30,
) -> list[dict[str, Any]]:
    """비자 스폰서십을 명시적으로 제공하는 공고만 찾습니다.

    description 에 "visa sponsorship", "relocation", "H-1B", "Blue Card" 등이
    명시된 공고를 반환. evidence 필드에 매칭된 원문 단편이 포함됩니다.
    """
    jobs = await _multi_source_search(query, location)
    sponsors = [j for j in jobs if j.visa_status == "sponsors"]
    return [
        {**j.to_dict(), "description_preview": j.description[:400]}
        for j in sponsors[:limit]
    ]


@mcp.tool()
async def match_resume_to_job(resume_text: str, job_id: str) -> dict[str, Any]:
    """이력서와 공고를 비교해 기술 스택 갭을 분석합니다.

    Returns:
        - job_requires : 공고에서 추출한 요구 기술
        - matched      : 이력서와 일치하는 기술
        - missing      : 부족한 기술 (보완 필요)
        - resume_extras: 이력서에는 있으나 공고에 없는 기술 (어필 포인트 또는 무관)
        - match_ratio  : 매칭 비율
        - visa_status  : 해당 공고의 비자 분류
    """
    detail = await get_job_details(job_id)
    if "error" in detail:
        return detail

    description = detail.get("description", "")
    analysis = stack_analyzer.match_resume(resume_text, description)
    analysis["job_title"] = detail.get("title")
    analysis["company"] = detail.get("company")
    analysis["visa_status"] = detail.get("visa_status")
    analysis["visa_evidence"] = detail.get("visa_evidence", [])
    return analysis


@mcp.tool()
async def check_new_jobs(
    query: str,
    location: str = "",
    remote_only: bool = False,
) -> dict[str, Any]:
    """마지막 체크 이후 새로 올라온 공고만 반환합니다.

    내부적으로 본 적 있는 job_id 를 SQLite 에 저장하고, 다음 호출 시 신규만 골라냅니다.
    같은 query 로 주기적으로 호출하면 모니터링 효과.
    """
    jobs = await _multi_source_search(query, location, remote_only)
    new_jobs = storage.filter_new_jobs(jobs)
    return {
        "total_found": len(jobs),
        "new_count": len(new_jobs),
        "new_jobs": [
            {
                "job_id": j.job_id,
                "title": j.title,
                "company": j.company,
                "location": j.location,
                "is_remote": j.is_remote,
                "visa_status": j.visa_status,
                "apply_url": j.apply_url,
                "posted_at": j.posted_at,
            }
            for j in new_jobs
        ],
    }


@mcp.tool()
async def get_salary_insights(
    query: str,
    location: str = "",
    remote_only: bool = False,
) -> dict[str, Any]:
    """직무/지역에 대한 연봉 통계를 산출합니다.

    공고에서 공개된 연봉 정보를 USD 연봉 기준으로 정규화한 뒤
    중앙값/평균/분포를 계산합니다. 연봉 공개율이 낮은 경우 sample_size 가 작을 수 있음.
    """
    jobs = await _multi_source_search(query, location, remote_only)
    return salary_analyzer.compute_salary_stats(jobs)


# ---------- 추천 시스템 (v2: 규칙 + 임베딩 하이브리드) ----------

async def _collect_recommendation_candidates(
    user: UserProfile,
    extra_companies: list[str] | None = None,
    per_query_limit: int = 30,
) -> list[JobPosting]:
    """추천용 후보 공고를 광범위하게 수집.

    - 사용자 상위 스킬 3~5개를 각각 쿼리로 멀티 소스 검색
    - 지정한 회사가 있으면 Greenhouse/Lever 에서 직접 조회
    - 결과 합치고 중복 제거 + enrich
    """
    tasks = []

    # 1. 스택 키워드로 검색 (상위 5개)
    for skill in user.skills[:5]:
        tasks.append(_multi_source_search(
            query=skill,
            location="",  # 위치 필터는 점수화 단계에서
            remote_only=(user.remote_preference == "remote_only"),
            limit_per_source=per_query_limit,
        ))

    # 2. bio 가 있으면 첫 단어들로도 검색
    if user.bio:
        bio_query = " ".join(user.bio.split()[:5])
        tasks.append(_multi_source_search(
            query=bio_query,
            remote_only=(user.remote_preference == "remote_only"),
            limit_per_source=per_query_limit,
        ))

    # 3. 회사 직접 조회 (있으면)
    company_tasks = []
    for company in (extra_companies or []):
        company_tasks.append(_fetch_company_safe(company))

    search_results = await asyncio.gather(*tasks, return_exceptions=True)
    company_results = await asyncio.gather(*company_tasks, return_exceptions=True)

    merged: list[JobPosting] = []
    for r in list(search_results) + list(company_results):
        if isinstance(r, Exception):
            continue
        merged.extend(r)

    # 중복 제거 (job_id 기준)
    seen: set[str] = set()
    unique: list[JobPosting] = []
    for j in merged:
        if j.job_id in seen:
            continue
        seen.add(j.job_id)
        unique.append(j)

    return unique


async def _fetch_company_safe(company: str) -> list[JobPosting]:
    """레지스트리에서 ATS 를 확인하고 그에 맞는 소스에서 조회.
    레지스트리에 없으면 Greenhouse → Lever → Ashby 순으로 시도.
    """
    info = registry.resolve(company)
    jobs: list[JobPosting] = []

    if info:
        ats = info["ats"]
        token = info["token"]
        try:
            if ats == "greenhouse":
                jobs = await greenhouse.fetch(company=token)
            elif ats == "lever":
                jobs = await lever.fetch(company=token)
            elif ats == "ashby":
                jobs = await ashby.fetch(company=token)
        except Exception:
            pass
    else:
        # 레지스트리에 없으면 모든 ATS 시도
        for src in (greenhouse, lever, ashby):
            try:
                jobs = await src.fetch(company=company)
                if jobs:
                    break
            except Exception:
                continue

    return [_enrich(j) for j in jobs]


@mcp.tool()
async def recommend_jobs(
    skills: list[str],
    seniority: str,
    years_experience: int = 0,
    resume_text: str = "",
    bio: str = "",
    needs_visa_sponsorship: bool = False,
    preferred_locations: list[str] | None = None,
    remote_preference: str = "any",
    desired_salary_usd: int | None = None,
    excluded_companies: list[str] | None = None,
    target_companies: list[str] | None = None,
    top_k: int = 10,
    weights: dict | None = None,
    max_per_company: int = 2,
    use_learned_weights: bool = False,
) -> dict[str, Any]:
    """사용자 프로필에 맞는 채용 공고를 점수화해서 상위 K개 추천합니다.

    규칙 기반 점수(스택/비자/지역/시니어리티/연봉) + 임베딩 의미 유사도 하이브리드.
    각 추천에 score_breakdown 과 reasons 가 포함되어 왜 추천했는지 설명 가능.

    Args:
        skills: 사용자 보유 기술 리스트 (예: ["python", "django", "aws", "kubernetes"])
        seniority: "junior" / "mid" / "senior" / "staff" / "principal"
        years_experience: 경력 연수
        resume_text: 이력서 전문 텍스트 (한/영 무관, 의미 유사도 매칭용)
        bio: 짧은 자기소개 (예: "ML 인프라에 관심 많은 백엔드 개발자")
        needs_visa_sponsorship: 비자 스폰서십 필요 여부
        preferred_locations: 희망 지역 리스트 (예: ["Berlin", "Amsterdam", "Remote"])
        remote_preference: "remote_only" / "hybrid_ok" / "any"
        desired_salary_usd: 최소 희망 연봉 (USD/연)
        excluded_companies: 제외할 회사 리스트
        target_companies: 특별히 관심있는 회사 (Greenhouse/Lever ATS token, 예: ["stripe", "notion"])
        top_k: 추천 받을 공고 수 (기본 10)
        weights: 점수 가중치 커스터마이즈 (예: {"visa": 0.4, "stack": 0.3, ...})
        max_per_company: 같은 회사에서 최대 몇 개까지 (다양성 제약, 기본 2)

    Returns:
        - total_candidates: 점수화된 후보 수
        - recommendations: 상위 K개 공고 (점수와 추천 이유 포함)
    """
    user = UserProfile(
        skills=skills,
        seniority=seniority,
        years_experience=years_experience,
        resume_text=resume_text,
        bio=bio,
        needs_visa_sponsorship=needs_visa_sponsorship,
        preferred_locations=preferred_locations or [],
        remote_preference=remote_preference,
        desired_salary_usd=desired_salary_usd,
        excluded_companies=excluded_companies or [],
    )

    candidates = await _collect_recommendation_candidates(
        user, extra_companies=target_companies
    )

    # 학습된 가중치 보너스 적용 (옵션)
    learned_info = None
    if use_learned_weights:
        base = weights or {
            "stack": 0.35, "visa": 0.20, "location": 0.15,
            "seniority": 0.10, "salary": 0.10, "semantic": 0.10,
        }
        weights = feedback_mod.apply_to_weights(base)
        learned_info = feedback_mod.get_summary()

    recommendations = await recommender_engine.recommend(
        candidate_pool=candidates,
        user=user,
        top_k=top_k,
        weights=weights,
        max_per_company=max_per_company,
    )

    result = {
        "total_candidates": len(candidates),
        "recommendations_returned": len(recommendations),
        "recommendations": recommendations,
    }
    if learned_info is not None:
        result["learned_weights_applied"] = learned_info
        result["effective_weights"] = weights
    return result


def main():
    mcp.run()


# ---------- 회사 레지스트리 / 정보 ----------

@mcp.tool()
async def find_companies(
    tags: list[str] | None = None,
    query: str = "",
) -> list[dict[str, Any]]:
    """레지스트리에서 회사 검색.

    Args:
        tags: 태그 기반 OR 검색 (예: ["fintech", "europe", "ai", "remote-first"])
        query: 이름 부분 일치 검색

    Returns:
        매칭된 회사 리스트 (name, ats, token, tags).
        결과의 'name' 이나 'token' 을 list_company_jobs(company=...) 에 그대로 사용 가능.
    """
    if tags:
        results = registry.search_by_tag(tags)
    else:
        results = registry.list_all()

    if query:
        q_lower = query.lower()
        results = [r for r in results if q_lower in r["name"].lower()]

    return results


@mcp.tool()
async def get_company_intel(company: str, months_back: int = 12) -> dict[str, Any]:
    """회사 평판/언급 정보 조회.

    Hacker News 최근 언급 (제목, 점수, 댓글, URL) + 레지스트리 메타데이터.

    Args:
        company: 회사명
        months_back: 몇 개월 전까지 HN 언급을 가져올지 (기본 12개월)

    Returns:
        company_info, hn_mentions, hn_sentiment_hints, tldr.
        Claude 가 mentions 의 제목/URL 을 보고 종합 판단할 수 있게 raw 데이터 포함.
    """
    return await intel.get_company_intel(company, months_back=months_back)


# ---------- 지원 추적 ----------

@mcp.tool()
async def track_application(
    job_id: str,
    status: str,
    notes: str = "",
    title: str = "",
    company: str = "",
    location: str = "",
    apply_url: str = "",
) -> dict[str, Any]:
    """공고 지원 상태를 추적/업데이트.

    Args:
        job_id: 추적할 공고 ID (search_dev_jobs / recommend_jobs 결과 그대로)
        status: interested / applied / phone_screen / take_home / onsite / offer / accepted / rejected / withdrawn
        notes: 메모 (인터뷰 후기, 다음 단계 등)
        title, company, location, apply_url: 새로 추가하는 경우의 메타데이터 (이미 추적 중이면 무시)

    Returns:
        {job_id, status, action, timestamp}
        action 은 'created' / 'updated (이전→현재)' / 'note_updated' / 'no_change'
    """
    return tracker.track(
        job_id=job_id, status=status, notes=notes,
        title=title, company=company, location=location, apply_url=apply_url,
    )


@mcp.tool()
async def list_applications(
    status: str = "all",
    company: str = "",
) -> list[dict[str, Any]]:
    """내가 추적 중인 모든 공고 조회.

    Args:
        status: 필터링할 상태. "all" 이면 전체.
        company: 회사명 필터 (선택)
    """
    return tracker.list_applications(
        status=status if status != "all" else None,
        company=company or None,
    )


@mcp.tool()
async def get_pipeline_summary() -> dict[str, Any]:
    """지원 파이프라인 통계 요약.

    Returns:
        - total_applications: 전체 지원 수
        - active_applications: 진행 중인 지원 (final 상태 제외)
        - by_status: 상태별 카운트
        - funnel: 표준 단계별 카운트 (시각화에 좋음)
        - recent_activity_7d: 최근 7일 이벤트 수
        - acceptance_rate: 합격률 (accepted/(accepted+rejected))
    """
    return tracker.get_pipeline_summary()


@mcp.tool()
async def get_application_history(job_id: str) -> dict[str, Any]:
    """특정 공고의 지원 이력 (상태 변경 이벤트 전체)."""
    return tracker.get_application_history(job_id)


# ---------- Application Kit (통합) ----------

@mcp.tool()
async def prepare_application_kit(
    job_id: str,
    resume_text: str = "",
    user_bio: str = "",
) -> dict[str, Any]:
    """특정 공고에 지원하기 위한 모든 정보를 한 번에 모은다.

    포함 내용:
    - 공고 핵심 정보 + description 전문
    - 비자 분석 + 해석
    - 스킬 갭 분석 (이력서 제공 시)
    - 회사 정보 (HN 최근 언급 + 레지스트리 메타데이터)
    - 이전 지원 이력 (이미 추적 중이면)
    - 커버레터 talking points
    - 다음 행동 제안

    Args:
        job_id: 분석할 공고 ID
        resume_text: 이력서 전문 (스킬 갭과 talking points 에 활용)
        user_bio: 짧은 자기소개 (커버레터 보강용)

    Returns:
        구조화된 정보 다발. Claude 가 이를 종합해 자연어 커버레터, 인터뷰 예상 질문,
        지원 전 체크리스트 등을 작성할 수 있음.
    """
    # 1) 공고 가져오기 (get_job_details 와 같은 로직)
    detail = await get_job_details(job_id)
    if "error" in detail:
        return detail

    # detail 을 JobPosting 으로 복원
    job = JobPosting(
        job_id=job_id,
        source=job_id.split(":", 1)[0],
        title=detail.get("title", ""),
        company=detail.get("company", ""),
        location=detail.get("location", ""),
        is_remote=bool(detail.get("is_remote")),
        employment_type=detail.get("employment_type", ""),
        description=detail.get("description", ""),
        apply_url=detail.get("apply_url", ""),
        posted_at=detail.get("posted_at", ""),
        tags=detail.get("tags") or [],
        salary_min=detail.get("salary_min"),
        salary_max=detail.get("salary_max"),
        salary_currency=detail.get("salary_currency", ""),
        salary_period=detail.get("salary_period", ""),
        visa_status=detail.get("visa_status", "unclear"),
        visa_evidence=detail.get("visa_evidence", []) or [],
    )

    return await app_kit.build_kit(job=job, resume_text=resume_text, user_bio=user_bio)


# ---------- 회사 블로그 RSS 모니터링 ----------

@mcp.tool()
async def subscribe_company_blog(company: str, feed_url: str, kind: str = "blog") -> dict[str, Any]:
    """회사의 RSS/Atom 피드 구독을 등록합니다 (기술 블로그, 채용 공식 발표 등).

    Args:
        company: 회사명 (예: "stripe", "vercel"). 소문자로 정규화됨.
        feed_url: 피드 URL (RSS 2.0 또는 Atom 1.0)
        kind: "blog" / "engineering" / "careers" 등 분류 라벨
    """
    return rss_monitor.subscribe(company, feed_url, kind)


@mcp.tool()
async def unsubscribe_company_blog(company: str) -> dict[str, Any]:
    """구독 해제."""
    return rss_monitor.unsubscribe(company)


@mcp.tool()
async def list_blog_subscriptions() -> dict[str, Any]:
    """현재 구독 중인 모든 회사 블로그 목록."""
    subs = rss_monitor.list_subscriptions()
    return {"count": len(subs), "subscriptions": subs}


@mcp.tool()
async def check_new_blog_posts(company: str | None = None) -> dict[str, Any]:
    """구독된 피드에서 마지막 체크 이후 신규 글만 반환합니다.

    Args:
        company: 특정 회사만 체크 (None 이면 전체)
    """
    return await rss_monitor.check_new_posts(company)


# ---------- 인터뷰 준비 ----------

@mcp.tool()
async def generate_interview_prep(
    job_id: str,
    stage: str,
    user_strengths: list[str] | None = None,
) -> dict[str, Any]:
    """인터뷰 단계별 준비 자료를 생성합니다.

    Args:
        job_id: 대상 공고 ID
        stage: phone_screen / take_home / onsite / system_design / behavioral
        user_strengths: 강조하고 싶은 본인 강점 (선택)

    Returns:
        prep_kit: 단계별 common_questions, preparation_actions, stack_specific_topics,
                  questions_to_ask_them 포함.
    """
    parts = job_id.split(":", 1)
    if len(parts) != 2:
        return {"error": f"잘못된 job_id 형식: {job_id}"}
    source = parts[0]
    detail = await _multi_source_search(query="", location="", remote_only=False, limit_per_source=0)
    # get_job_details 와 동일한 흐름이지만 단순화: 캐시된 공고만 사용 안 하고 search 결과에서 매칭
    # 정확한 매칭을 위해 get_job_details 재사용
    full = await get_job_details(job_id)
    if "error" in full:
        return full
    # full 은 dict이므로 JobPosting 재구성
    job = JobPosting(
        job_id=full.get("job_id", job_id),
        source=full.get("source", source),
        title=full.get("title", ""),
        company=full.get("company", ""),
        location=full.get("location", ""),
        is_remote=full.get("is_remote", False),
        employment_type=full.get("employment_type", ""),
        description=full.get("description", ""),
        apply_url=full.get("apply_url", ""),
        posted_at=full.get("posted_at", ""),
        tags=full.get("tags", []) or [],
        salary_min=full.get("salary_min"),
        salary_max=full.get("salary_max"),
        salary_currency=full.get("salary_currency", "") or "",
        salary_period=full.get("salary_period", "") or "",
        visa_status=full.get("visa_status", "unclear") or "unclear",
    )
    return interview_prep_mod.generate(job, stage, user_strengths)


# ---------- 추천 피드백 루프 ----------

@mcp.tool()
async def record_recommendation_feedback(
    job_id: str,
    rating: str,
    score_breakdown: dict | None = None,
    notes: str = "",
) -> dict[str, Any]:
    """추천 결과에 대한 사용자 피드백(positive/negative) 기록.

    이후 recommend_jobs(use_learned_weights=True) 호출 시 자동 가중치 보정에 사용됨.

    Args:
        job_id: 피드백 대상 공고 ID
        rating: "positive" 또는 "negative"
        score_breakdown: 추천 당시 받았던 score_breakdown 그대로 (학습용)
        notes: 자유 메모 (왜 좋아했는지/싫었는지)
    """
    return feedback_mod.record(job_id, rating, score_breakdown, notes)


@mcp.tool()
async def get_feedback_summary() -> dict[str, Any]:
    """누적된 피드백과 학습된 가중치 보너스 요약."""
    return feedback_mod.get_summary()


# ---------- 이력서 최적화 ----------

@mcp.tool()
async def optimize_resume_for_job(resume_text: str, job_id: str) -> dict[str, Any]:
    """특정 공고에 맞춰 이력서 줄을 재배치하고 누락된 키워드를 제안.

    Args:
        resume_text: 이력서 전문 (줄바꿈 포함)
        job_id: 대상 공고 ID
    """
    full = await get_job_details(job_id)
    if "error" in full:
        return full
    job = JobPosting(
        job_id=full.get("job_id", job_id),
        source=full.get("source", ""),
        title=full.get("title", ""),
        company=full.get("company", ""),
        location=full.get("location", ""),
        is_remote=full.get("is_remote", False),
        employment_type=full.get("employment_type", ""),
        description=full.get("description", ""),
        apply_url=full.get("apply_url", ""),
        posted_at=full.get("posted_at", ""),
        tags=full.get("tags", []) or [],
        salary_min=full.get("salary_min"),
        salary_max=full.get("salary_max"),
        salary_currency=full.get("salary_currency", "") or "",
        salary_period=full.get("salary_period", "") or "",
        visa_status=full.get("visa_status", "unclear") or "unclear",
    )
    return resume_optimizer.optimize(resume_text, job)


# ---------- 거절 회복 ----------

@mcp.tool()
async def find_recovery_path(
    rejected_job_id: str,
    reason: str = "",
    mark_rejected: bool = True,
) -> dict[str, Any]:
    """거절된 공고에 대해 비슷한 회사 추천 + 다음 행동 + 통계 제공.

    Args:
        rejected_job_id: tracker 에 등록된 거절 공고 ID
        reason: 거절 사유 메모 (선택)
        mark_rejected: True 면 tracker 상태를 'rejected' 로 업데이트
    """
    return rejection_recovery.recover(rejected_job_id, reason, mark_rejected)


# ---------- ultrawork (omo 패턴 적용) ----------

@mcp.tool()
async def ultrawork(
    skills: list[str],
    seniority: str,
    years_experience: int = 0,
    resume_text: str = "",
    bio: str = "",
    needs_visa_sponsorship: bool = False,
    preferred_locations: list[str] | None = None,
    remote_preference: str = "any",
    desired_salary_usd: int | None = None,
    excluded_companies: list[str] | None = None,
    target_companies: list[str] | None = None,
    top_k: int = 10,
    enrich_top: int = 3,
    include_intel: bool = True,
    intel_months_back: int = 6,
    weights: dict | None = None,
    max_per_company: int = 2,
) -> dict[str, Any]:
    """채용 워크플로우 한 번에 — 검색 → 추천 → 회사 인텔 → 다음 행동 제안.

    oh-my-openagent (omo) 의 ultrawork 패턴을 채용 도메인에 적용한 메타 tool.
    개별 tool 들 (recommend_jobs, get_company_intel, ...) 을 직접 호출하는 대신
    이거 하나로 사용자 프로필 → 종합 결과까지 한 번에.

    상위 enrich_top 개 회사에만 HN 인텔 보강해 외부 API 호출 폭증 방지.

    Args:
        skills~target_companies: recommend_jobs 와 동일
        top_k: 추천 받을 공고 수
        enrich_top: 상위 몇 개에 회사 인텔 보강할지 (기본 3)
        include_intel: HN Algolia 호출 여부
        intel_months_back: 인텔 조회 기간 (개월)
        weights, max_per_company: recommend_jobs 동일

    Returns:
        workflow / profile_summary / recommendations / enriched_top_picks /
        aggregate_insights / next_actions / note
    """
    user = UserProfile(
        skills=skills,
        seniority=seniority,
        years_experience=years_experience,
        resume_text=resume_text,
        bio=bio,
        needs_visa_sponsorship=needs_visa_sponsorship,
        preferred_locations=preferred_locations or [],
        remote_preference=remote_preference,
        desired_salary_usd=desired_salary_usd,
        excluded_companies=excluded_companies or [],
    )
    candidates = await _collect_recommendation_candidates(
        user, extra_companies=target_companies
    )
    return await ultrawork_mod.run(
        user=user,
        candidates=candidates,
        top_k=top_k,
        enrich_top=enrich_top,
        include_intel=include_intel,
        intel_months_back=intel_months_back,
        weights=weights,
        max_per_company=max_per_company,
    )


# ---------- Discipline Agents (omo 패턴) ----------

@mcp.tool()
async def list_disciplines(name: str | None = None) -> dict[str, Any]:
    """채용 워크플로우 단계별 agent 그룹을 반환합니다 (oh-my-openagent 패턴).

    25개 tool 을 5개 역할 (Scout / Analyst / Strategist / Tracker / Recovery) 로
    그룹화한 메타데이터. Claude 가 어떤 상황에 어떤 tool 군을 써야 할지 빠르게 파악.

    Args:
        name: discipline 이름 (scout / analyst / strategist / tracker / recovery).
              None 이면 전체 요약, 지정 시 해당 agent 의 tools + when_to_use + tips 상세.

    Returns:
        name=None: {workflow, total_disciplines, disciplines: [{key, name, role, tool_count, next_discipline}]}
        name 지정: {key, name, role, when_to_use, tools, tool_count, next_discipline, tips}
    """
    if name:
        return disciplines_mod.get_one(name)
    return disciplines_mod.list_all()


if __name__ == "__main__":
    main()
