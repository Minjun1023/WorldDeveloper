"""Discipline Agents 그룹화 (oh-my-openagent 패턴).

dev-jobs-mcp 의 tool 들을 5개 역할 기반 agent 로 분류.
omo 의 Sisyphus/Hephaestus/Prometheus/Oracle 이 코드 작업의 역할 분담이라면,
여기서는 채용 활동의 워크플로우 단계를 agent 로 표현.

이 모듈은 코드 동작에는 영향 없음 — 순수 메타데이터.
Claude 가 어떤 상황에 어떤 tool 군을 써야 할지 빠르게 파악하는 데 사용.

워크플로우:
  Scout (탐색)
     ↓
  Analyst (분석)
     ↓
  Strategist (전략/추천)
     ↓
  Tracker (지원·기록)
     ↓
  Recovery (거절·회복)  -- Scout 로 회귀 --
"""
from __future__ import annotations
from typing import Any

DISCIPLINES: dict[str, dict[str, Any]] = {
    "scout": {
        "name": "Scout",
        "role": "탐색가 — 채용 시장에서 새로운 공고·회사를 발견하고 필터링",
        "when_to_use": (
            "사용자가 새 공고를 찾기 시작할 때, 특정 회사 공고를 보고 싶을 때, "
            "검색 결과를 좁히고 싶을 때, 신규 공고 모니터링이 필요할 때."
        ),
        "tools": [
            {"name": "search_dev_jobs", "summary": "키워드·지역·원격·비자 필터로 멀티 소스 통합 검색"},
            {"name": "list_company_jobs", "summary": "특정 회사 ATS (Greenhouse/Lever/Ashby) 직접 조회"},
            {"name": "find_visa_sponsors", "summary": "비자 스폰서십 명시 공고만 필터링"},
            {"name": "find_companies", "summary": "registry 태그(fintech/europe 등)로 회사 검색"},
            {"name": "check_new_jobs", "summary": "마지막 체크 이후 신규 공고만 (SQLite 추적)"},
        ],
        "next_discipline": "analyst",
        "tips": "포지셔닝이 명확할수록 정확. 'EU 비자 가능한 Python 시니어' 처럼 구체적으로.",
    },
    "analyst": {
        "name": "Analyst",
        "role": "분석가 — 공고·회사·연봉을 깊이 평가하고 사용자 맥락에 매핑",
        "when_to_use": (
            "Scout 가 모은 후보 중 본격적으로 깊이 들어갈 때, 회사 평판 확인, "
            "이력서가 공고에 얼마나 맞는지 갭 분석, 연봉 통계 필요 시."
        ),
        "tools": [
            {"name": "get_job_details", "summary": "단일 공고 풀 description + 비자·스택 분석"},
            {"name": "get_company_intel", "summary": "HN Algolia 최근 멘션 + 평판 신호"},
            {"name": "match_resume_to_job", "summary": "이력서 vs 공고 스택 갭 분석"},
            {"name": "get_salary_insights", "summary": "직무·지역별 USD 연봉 통계"},
        ],
        "next_discipline": "strategist",
        "tips": "match_ratio 가 0.6 미만이면 이력서 보강이나 다른 공고 고려.",
    },
    "strategist": {
        "name": "Strategist",
        "role": "전략가 — 추천·우선순위·지원 준비 종합 계획",
        "when_to_use": (
            "여러 후보 중 우선순위를 정할 때, 종합 추천이 필요할 때, 지원 직전 "
            "준비 키트가 필요할 때, 인터뷰 단계별 가이드가 필요할 때."
        ),
        "tools": [
            {"name": "recommend_jobs", "summary": "사용자 프로필로 6차원 점수 추천 + 다양성 제약"},
            {"name": "prepare_application_kit", "summary": "비자 + 스킬 갭 + 회사 정보 + talking points 종합"},
            {"name": "generate_interview_prep", "summary": "phone_screen/take_home/onsite/system_design/behavioral 단계별 prep"},
            {"name": "ultrawork", "summary": "검색→추천→인텔→다음 행동까지 한 번에 (메타 tool)"},
        ],
        "next_discipline": "tracker",
        "tips": "ultrawork 가 가장 강력. 사용자 프로필 한 번 입력하면 전체 워크플로우 시작점.",
    },
    "tracker": {
        "name": "Tracker",
        "role": "추적자 — 지원 상태·이벤트·신규 글 모니터링·피드백 기록",
        "when_to_use": (
            "공고에 지원했을 때, 인터뷰 상태 변화 시, 회사 블로그 모니터링, "
            "추천 결과 피드백 (학습 데이터) 쌓기."
        ),
        "tools": [
            {"name": "track_application", "summary": "공고 상태 기록·업데이트 (interested/applied/phone_screen/...)"},
            {"name": "list_applications", "summary": "내 지원 목록"},
            {"name": "get_pipeline_summary", "summary": "funnel 통계 (interested → ... → accepted)"},
            {"name": "get_application_history", "summary": "특정 공고의 모든 이벤트 이력"},
            {"name": "subscribe_company_blog", "summary": "회사 RSS/Atom 피드 구독"},
            {"name": "unsubscribe_company_blog", "summary": "구독 해제"},
            {"name": "list_blog_subscriptions", "summary": "구독 목록"},
            {"name": "check_new_blog_posts", "summary": "신규 글 감지 (SQLite seen tracking)"},
            {"name": "record_recommendation_feedback", "summary": "추천 +/- 피드백 (학습용)"},
            {"name": "get_feedback_summary", "summary": "누적 피드백 + 학습된 가중치 보너스"},
        ],
        "next_discipline": "recovery",
        "tips": "track_application 은 동일 job_id 재호출 시 status 업데이트. funnel 데이터가 거절 회복의 input.",
    },
    "recovery": {
        "name": "Recovery",
        "role": "회복가 — 거절 후 다음 단계 + 이력서 최적화 + 비슷한 회사 탐색",
        "when_to_use": (
            "거절 통보를 받았을 때, 같은 공고 카테고리에서 다시 도전하고 싶을 때, "
            "이력서를 특정 공고에 맞춰 최적화하고 싶을 때."
        ),
        "tools": [
            {"name": "find_recovery_path", "summary": "거절된 공고의 회사 태그 → 비슷한 회사 추천 + 다음 행동 + 통계"},
            {"name": "optimize_resume_for_job", "summary": "공고 키워드 매칭 + 줄 재배치 제안"},
        ],
        "next_discipline": "scout",
        "tips": "거절 후 1-2일 안에 recovery 호출 권장. funnel 통계로 객관적 시각 확보. recovery 가 끝나면 Scout 로 회귀 (사이클).",
    },
}


# tool 이름 → discipline 역매핑 (빠른 조회용)
_TOOL_TO_DISCIPLINE: dict[str, str] = {}
for disc_key, disc in DISCIPLINES.items():
    for t in disc["tools"]:
        _TOOL_TO_DISCIPLINE[t["name"]] = disc_key


def list_all() -> dict[str, Any]:
    """모든 discipline 의 요약을 반환."""
    return {
        "workflow": "scout → analyst → strategist → tracker → recovery → (scout)",
        "total_disciplines": len(DISCIPLINES),
        "disciplines": [
            {
                "key": k,
                "name": d["name"],
                "role": d["role"],
                "tool_count": len(d["tools"]),
                "next_discipline": d["next_discipline"],
            }
            for k, d in DISCIPLINES.items()
        ],
        "note": (
            "각 discipline 의 상세 (tools + when_to_use + tips) 는 "
            "list_disciplines(name='scout') 처럼 name 지정해서 호출."
        ),
    }


def get_one(name: str) -> dict[str, Any]:
    """특정 discipline 의 상세 정보."""
    key = (name or "").lower()
    if key not in DISCIPLINES:
        return {
            "error": f"unknown discipline '{name}'. Available: {list(DISCIPLINES.keys())}",
        }
    d = DISCIPLINES[key]
    return {
        "key": key,
        "name": d["name"],
        "role": d["role"],
        "when_to_use": d["when_to_use"],
        "tools": d["tools"],
        "tool_count": len(d["tools"]),
        "next_discipline": d["next_discipline"],
        "tips": d["tips"],
    }


def lookup_tool(tool_name: str) -> str | None:
    """tool 이 어떤 discipline 에 속하는지."""
    return _TOOL_TO_DISCIPLINE.get(tool_name)
