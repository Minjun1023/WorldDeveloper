"""개발 스킬 표준 분류(taxonomy) + 표면형/구절 매칭 헬퍼 — 코치 키워드 갭(present/missing)용.

코치는 '공고 요구 스킬이 이력서에 있는가'를 판정해 LLM 프롬프트에 넣는다(buildContext).
backend ResumeOptimizer 는 고정 ~30단어 어휘 + 별칭 매칭(#306)을 쓴다. 이 모듈은 그것을
~45개 스킬로 확장하고, semantic(임베딩) 매칭의 기반이 되는 데이터/표면형 헬퍼를 제공한다.

설계 노트:
  - 순수 데이터 + 표면형/구절 분리 헬퍼만 둔다. torch / sentence-transformers / dev_jobs_core
    임베딩을 **모듈 최상단에서 import 하지 않는다** (ai CI 는 torch 없이 `import app.main` 만 함).
  - 별칭(aliases)은 backend TechExtractor.ALIASES(#306)와 겹치는 부분에서 일관되게 유지.
  - gloss 는 semantic 신호용 짧은 패러프레이즈 확장(회수율↑). alias 매칭에는 쓰이지 않는다.
  - 평가(ai/scripts/skill_match_eval.py)에서 cosine 임계값 0.50 이 precision 100% 유지하며
    recall 71%→87% 로 가장 좋았다 → 엔드포인트 기본 임계값 0.50.
"""

from __future__ import annotations

import re

# 표준 스킬명(canonical) → (별칭 표면형 목록, 의미 gloss).
# 별칭은 약어(k8s)·다른 표기(postgres)·한글 표기(쿠버네티스)를 같은 스킬로 인식하기 위한 사전.
# 짧고 모호한 별칭(go 의 '고', ts/js 등)은 오탐 위험으로 제외한다.
SKILLS: dict[str, tuple[list[str], str]] = {
    # --- 언어 ---
    "Python": (["파이썬"], "Python programming language"),
    "Java": (["자바"], "Java JVM programming language"),
    "Kotlin": (["코틀린"], "Kotlin JVM Android programming"),
    "Go": (["golang", "고랭"], "Go programming language"),
    "TypeScript": (["타입스크립트"], "TypeScript typed JavaScript"),
    "JavaScript": (["자바스크립트"], "JavaScript programming language"),
    "Rust": (["러스트"], "Rust systems programming"),
    "Scala": (["스칼라"], "Scala functional JVM language"),
    "C++": (["cpp", "씨쁠쁠"], "C++ systems programming"),
    # --- 백엔드 프레임워크 ---
    "Spring": (["spring boot", "스프링", "스프링부트"], "Spring Boot Java backend framework"),
    "Django": (["장고"], "Django Python web framework"),
    "Flask": (["플라스크"], "Flask Python micro web framework"),
    "FastAPI": (["fast api", "패스트api"], "FastAPI Python async web framework"),
    "Node.js": (["nodejs", "node", "노드", "노드js"], "Node.js server-side JavaScript runtime"),
    # --- 프론트엔드 ---
    "React": (["리액트"], "React frontend UI library"),
    "Vue": (["vue.js", "vuejs", "뷰"], "Vue.js frontend framework"),
    "Angular": (["앵귤러"], "Angular frontend framework"),
    "Next.js": (["nextjs", "next js", "넥스트"], "Next.js React server-side rendering framework"),
    # --- 데이터베이스 ---
    "PostgreSQL": (["postgres", "포스트그레스"], "PostgreSQL relational database SQL"),
    "MySQL": (["마이에스큐엘"], "MySQL relational database SQL"),
    "MongoDB": (["mongo", "몽고", "몽고디비"], "MongoDB document NoSQL database"),
    "Redis": (["레디스"], "Redis in-memory cache key-value store"),
    "Elasticsearch": (["elastic search", "es", "엘라스틱서치"], "Elasticsearch full-text search engine"),
    # --- 메시징/스트리밍 ---
    "Kafka": (["카프카"], "Apache Kafka event streaming distributed log"),
    "RabbitMQ": (["래빗엠큐"], "RabbitMQ message broker AMQP"),
    "Message Queue": (
        ["message queue", "메시지 큐", "메시지큐"],
        "asynchronous message broker event queue Kafka RabbitMQ pub sub",
    ),
    # --- 인프라/클라우드 ---
    "AWS": (["amazon web services"], "AWS Amazon cloud infrastructure"),
    "GCP": (["google cloud", "구글 클라우드"], "Google Cloud Platform infrastructure"),
    "Azure": (["애저"], "Microsoft Azure cloud infrastructure"),
    "Kubernetes": (["k8s", "쿠버네티스"], "Kubernetes container orchestration cluster"),
    "Docker": (["도커"], "Docker containerization images"),
    "Terraform": (["테라폼"], "Terraform infrastructure as code provisioning"),
    # --- 데이터/ML ---
    "Spark": (["apache spark", "스파크"], "Apache Spark big data distributed processing"),
    "Airflow": (["apache airflow", "에어플로우"], "Apache Airflow data pipeline workflow orchestration DAG"),
    "PyTorch": (["파이토치"], "PyTorch deep learning framework"),
    "TensorFlow": (["텐서플로우"], "TensorFlow deep learning framework"),
    # --- API/통신 ---
    "REST": (["rest api", "restful", "레스트"], "REST RESTful HTTP API design"),
    "GraphQL": (["graphql", "그래프큐엘"], "GraphQL query API schema"),
    "gRPC": (["grpc"], "gRPC RPC services using protocol buffers protobuf"),
    # --- 아키텍처/운영 개념 ---
    "Microservices": (
        ["microservice", "마이크로서비스", "msa"],
        "microservices distributed architecture service decomposition",
    ),
    "CI/CD": (
        ["ci/cd", "cicd", "continuous integration", "continuous delivery"],
        "automated build test deployment pipeline CI CD Jenkins GitHub Actions ArgoCD 배포 파이프라인",
    ),
    "Observability": (
        ["observability", "옵저버빌리티", "관측성"],
        "metrics logs distributed tracing Prometheus Grafana monitoring 지표 로그 트레이싱 모니터링",
    ),
    # --- 그 외 자주 등장 ---
    "Elixir": (["elixir", "엘릭서"], "Elixir Erlang BEAM concurrency"),
}

# 구절(구) 분리에 쓰는 구분자 — 이력서 한 줄을 의미 단위 클로즈로 쪼개 semantic 매칭 노이즈를 줄인다.
_SPLIT_TOKENS = ("\n", ",", "·", " and ", " 및 ", " 와 ", " 그리고 ", ";", "/")

# 소문자화하면 평범한 영어 단어/너무 일반적인 약어와 충돌하는 표면형.
# JD/이력서 산문("go above", "rest assured")이 Go/REST/Elasticsearch 를 오탐하게 만든다.
# 이 표면형들은 소문자 산문 대신 대문자/약어 표기("Go", "REST", "ES")로만 매칭한다(대소문자 가드).
# 구별력 있는 별칭(golang, restful, rest api, elasticsearch)은 영향 없음 → 실제 JD 는 그쪽으로 추출.
AMBIGUOUS: frozenset[str] = frozenset({"go", "rest", "es"})


def phrases(text: str) -> list[str]:
    """이력서 텍스트(또는 줄 목록)를 의미 단위 구절로 분해. 빈 구절은 제거."""
    out: list[str] = []
    for sep in _SPLIT_TOKENS:
        if not out:
            out = [seg for seg in text.split(sep)]
        else:
            out = [seg for p in out for seg in p.split(sep)]
    cleaned = [p.strip() for p in out if p.strip()]
    return cleaned or ([text.strip()] if text.strip() else [])


def token_hit(needle: str, text: str) -> bool:
    """needle(표면형) 이 text 안에 '토큰 경계'로 등장하면 True.

    text 는 호출 측에서 소문자화해 넘긴다. 공백은 \\s+ 로 유연 매칭(message queue ↔ message  queue).
    좌측은 영문/숫자/한글이 아닌 경계, 우측은 영문/숫자가 아닌 경계 — javascript 안의 java 등 오탐 방지.
    """
    pat = re.escape(needle.lower()).replace(r"\ ", r"\s+")
    return re.search(rf"(?<![a-z0-9가-힣]){pat}(?![a-z0-9])", text) is not None


def token_hit_cased(needle: str, original_text: str) -> bool:
    """needle(모호 표면형: go/rest/es) 이 original_text(소문자화하지 않은 원문) 안에
    '토큰 경계'로, **대문자/약어 표기**(Go/GO, REST/Rest, ES/Es)로 등장하면 True.

    오탐 방지용 — 평범한 산문은 소문자('go above', 'rest assured', 'es simple')이므로 거른다.
    캐논이 대문자라도 alias 가 소문자('es')로 저장될 수 있어, needle 의 대문자/타이틀 변형으로 매칭한다.
    경계는 token_hit 과 동일하되 IGNORECASE 를 쓰지 않는다(소문자 표기 불인정).
    """
    # 인정 표기: 전부 대문자(REST/ES/GO) 또는 첫 글자 대문자(Go/Rest/Es). 전부 소문자는 거른다.
    variants = {needle.upper(), needle[:1].upper() + needle[1:].lower()}
    alt = "|".join(re.escape(v).replace(r"\ ", r"\s+") for v in variants)
    return re.search(rf"(?<![A-Za-z0-9가-힣])(?:{alt})(?![A-Za-z0-9])", original_text) is not None


def surface_forms(skill: str) -> list[str]:
    """스킬의 모든 표면형(표준형 자기 자신 + 별칭)."""
    aliases, _gloss = SKILLS[skill]
    return [skill, *aliases]


def _surface_hit(surface: str, lowered_text: str, original_text: str) -> bool:
    """표면형 1개 매칭. 모호한 표면형(go/rest/es)은 원문 대소문자 가드로,
    나머지는 소문자 token_hit 으로 판정한다."""
    if surface.lower() in AMBIGUOUS:
        # 모호 표면형은 캐논("Go")이든 별칭("es")이든 대소문자 정확 표기만 인정.
        return token_hit_cased(surface, original_text)
    return token_hit(surface, lowered_text)


def matches_surface(skill: str, lowered_text: str, original_text: str | None = None) -> bool:
    """스킬의 표면형(별칭 포함) 중 하나라도 text 에 등장하면 True.

    모호한 표면형(go/rest/es)은 `original_text`(소문자화하지 않은 원문) 대상 **대소문자 가드** 매칭으로
    산문 오탐(go above / rest assured)을 거른다. original_text 미전달 시 lowered_text 로 폴백(가드 없음)."""
    src = lowered_text if original_text is None else original_text
    return any(_surface_hit(s, lowered_text, src) for s in surface_forms(skill))


def semantic_probe(skill: str) -> str:
    """스킬의 semantic 매칭 프로브 텍스트 = '표준명 별칭들 gloss'."""
    aliases, gloss = SKILLS[skill]
    return f"{skill} {' '.join(aliases)} {gloss}".strip()


def required_skills(jd: str) -> list[str]:
    """JD 에서 표면형(별칭 포함)이 등장하는 모든 표준 스킬 — 확장 추출(Java 30단어 대비).

    모호 표면형(go/rest/es)은 원문 JD 대상 대소문자 가드로 매칭해 산문 오탐을 막는다."""
    lowered = jd.lower()
    return [skill for skill in SKILLS if matches_surface(skill, lowered, jd)]
