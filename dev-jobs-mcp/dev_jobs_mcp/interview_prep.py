"""인터뷰 단계별 준비 자료 생성 (휴리스틱 템플릿).

MCP 서버에서 LLM 호출은 안 하고 구조화된 prep_kit 만 반환한다.
Claude 가 결과를 받아 사용자에게 자연어로 해설해주는 분업.
"""
from __future__ import annotations
from typing import Any

from .analyzers import stack as stack_analyzer
from .models import JobPosting

STAGES = ["phone_screen", "take_home", "onsite", "system_design", "behavioral"]

_STAGE_BLUEPRINT = {
    "phone_screen": {
        "duration": "30~45분",
        "focus": "이력서 검증, 기본 기술 지식, 회사 핏 초도 확인",
        "common_questions": [
            "본인 소개 + 최근 프로젝트 한 가지 짧게 설명 (2~3분)",
            "왜 이 회사/포지션에 관심이 있나요?",
            "이력서의 X 프로젝트에 대해 더 자세히 알려주세요",
            "선호하는 협업 방식과 코드리뷰 문화",
            "지금까지 가장 어려웠던 버그/기술 결정",
        ],
        "preparation_actions": [
            "60초 본인 소개 스크립트 작성 + 1회 녹음/리뷰",
            "이력서의 모든 프로젝트에 대해 STAR (상황·과제·행동·결과) 1줄씩 정리",
            "왜 이 회사인지 2~3문장으로 답할 수 있게 회사 블로그/제품 훑기",
        ],
    },
    "take_home": {
        "duration": "보통 3~8시간 (요구사항에 따라)",
        "focus": "프로덕션 수준 코드 작성 능력, 트레이드오프 판단, 문서화",
        "common_questions": [
            "(코드 외) README 에 설계 결정의 이유와 트레이드오프 명시",
            "(코드 외) 만약 시간 더 있으면 어떻게 개선할지 한 단락",
            "테스트 커버리지: 최소 happy path + 1~2 edge case",
        ],
        "preparation_actions": [
            "요구사항 다 읽고 어떤 시간 압박이 있는지 확인 (마감/총 시간)",
            "스코프를 의도적으로 줄이고 README 에 'out of scope' 명시 — 끝까지 못 한 것보다 작아도 마감이 낫다",
            "코드 스타일/린터 셋업: black/ruff/eslint 등 기본 도구 적용",
            "Git 커밋을 의미있는 단위로 (squash 말고 단계가 보이게)",
        ],
    },
    "onsite": {
        "duration": "보통 3~5시간, 4~6라운드",
        "focus": "코딩(라이브)·시스템 설계·행동 인터뷰·역질문까지 종합",
        "common_questions": [
            "라이브 코딩: 미들 난이도 알고리즘 1~2개 (LeetCode medium 급)",
            "시스템 설계: 'X 같은 서비스 설계해보세요' (open-ended)",
            "행동: 갈등 해결, 실패 경험, 리더십 사례",
            "역질문: 팀 구성/책임 범위/오너십/온콜/평가 방식",
        ],
        "preparation_actions": [
            "라이브 코딩은 '말하면서 푸는' 연습 필수 — 침묵 = 감점",
            "행동 인터뷰 5가지 시나리오 미리 준비 (실패/갈등/리더십/우선순위/배움)",
            "역질문 10개 준비 — 마지막 라운드에 시간 남으면 채울 수 있게",
            "전날 충분한 수면. 카페인 평소 양 유지 (과량 X)",
        ],
    },
    "system_design": {
        "duration": "45~60분",
        "focus": "확장성·내구성·트레이드오프·운영 관점",
        "common_questions": [
            "요구사항 명확화 질문부터 시작 (functional + non-functional)",
            "용량 추정 (QPS, 저장 데이터양, bandwidth)",
            "high-level 다이어그램 → 컴포넌트 깊이 파고들기",
            "스케일링/캐싱/일관성/장애 대응 시나리오",
        ],
        "preparation_actions": [
            "프레임워크 하나 고정: requirements → estimates → API → data model → high-level → deep dive → bottleneck",
            "주요 패턴 복습: load balancing, sharding, replication, queue, CDN, cache invalidation",
            "회사 제품과 유사한 시스템 1~2개 미리 손으로 설계 연습",
        ],
    },
    "behavioral": {
        "duration": "30~45분",
        "focus": "협업/리더십/판단력 (회사 가치관 정합성)",
        "common_questions": [
            "팀원/매니저와 의견 충돌했을 때 어떻게 해결했나",
            "마감이 빠듯할 때 우선순위 결정 사례",
            "기술 결정에서 잘못 판단한 경험 + 거기서 배운 것",
            "동료가 어려워하는 걸 도왔던 사례",
        ],
        "preparation_actions": [
            "STAR 포맷으로 5개 일화 미리 저장 (실패/갈등/리더십/배움/임팩트)",
            "각 일화에 metric (n명 영향, x% 개선 등) 한 개씩 끼워넣기",
            "회사 가치관 (values) 페이지 읽고, 본인 일화와 매핑",
        ],
    },
}


def _stack_specific_topics(job: JobPosting) -> list[str]:
    """공고에서 추출한 기술 스택별 인터뷰 단골 주제."""
    skills = set((s.lower() for s in (job.tags or [])))
    skills |= set(stack_analyzer.extract_tech(job.description or ""))

    topics: list[str] = []
    if {"python"} & skills:
        topics.append("Python: GIL/concurrency, async, type hints, decorators, context managers")
    if {"django", "flask", "fastapi"} & skills:
        topics.append("Web framework: ORM N+1, middleware/DI, request lifecycle, auth 패턴")
    if {"react", "next.js", "typescript"} & skills:
        topics.append("Frontend: state management, suspense/streaming, hydration, hooks rules")
    if {"go", "golang"} & skills:
        topics.append("Go: goroutines/channels, context, error handling, interface 설계")
    if {"java", "kotlin"} & skills:
        topics.append("JVM: GC, concurrency, Spring/DI, JIT")
    if {"rust"} & skills:
        topics.append("Rust: ownership/borrow, lifetimes, async runtimes, unsafe 경계")
    if {"postgresql", "mysql", "postgres", "sql"} & skills:
        topics.append("DB: index types, EXPLAIN, transaction isolation, deadlock")
    if {"redis", "kafka", "rabbitmq"} & skills:
        topics.append("Cache/Queue: TTL/eviction, consumer groups, at-least-once vs exactly-once")
    if {"aws", "gcp", "azure", "kubernetes", "k8s", "docker"} & skills:
        topics.append("Infra: container 격리, k8s pod/service, IAM, observability (logs/metrics/traces)")
    if {"ml", "pytorch", "tensorflow", "ai"} & skills:
        topics.append("ML: train/val/test 분리, overfitting, transformer 기초, eval metric 선택")
    return topics


def generate(job: JobPosting, stage: str, user_strengths: list[str] | None = None) -> dict[str, Any]:
    """단일 인터뷰 스테이지에 대한 prep kit 생성.

    Args:
        job: 대상 공고
        stage: phone_screen / take_home / onsite / system_design / behavioral
        user_strengths: 사용자 강점 (선택). reasons 에 반영.

    Returns:
        prep_kit dict — Claude 가 자연어로 해석하기 좋은 구조
    """
    stage = (stage or "").lower()
    if stage not in STAGES:
        return {"error": f"unknown stage '{stage}'. Allowed: {STAGES}"}

    blueprint = _STAGE_BLUEPRINT[stage]
    stack_topics = _stack_specific_topics(job)

    company_questions_to_ask = [
        f"{job.company} 팀의 일주일은 보통 어떤 모습인가요?",
        "이 포지션이 해결해야 할 가장 큰 기술적 도전은?",
        "온콜/배포/코드리뷰 프로세스가 어떻게 되나요?",
        "지난 6개월 안에 팀에서 가장 자랑스러운 성과는 무엇인가요?",
        "성과 평가는 어떤 기준으로 이뤄지나요?",
    ]

    return {
        "job_id": job.job_id,
        "title": job.title,
        "company": job.company,
        "stage": stage,
        "duration": blueprint["duration"],
        "focus": blueprint["focus"],
        "common_questions": blueprint["common_questions"],
        "preparation_actions": blueprint["preparation_actions"],
        "stack_specific_topics": stack_topics,
        "questions_to_ask_them": company_questions_to_ask,
        "user_strengths_to_emphasize": user_strengths or [],
        "note": (
            "이 prep kit 은 휴리스틱 템플릿입니다. Claude 가 회사 정보 (get_company_intel) "
            "와 결합해 맞춤 가이드를 만들어주는 것이 권장 사용 흐름입니다."
        ),
    }
