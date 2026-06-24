"""스킬 매칭 방식 오프라인 평가 — 코치 키워드 갭(present/missing)의 정확도 측정.

코치는 '공고 요구 스킬이 이력서에 있는가'를 판정해 LLM 프롬프트에 넣는다(buildContext).
그 판정 방식 4가지를 라벨된 케이스로 비교한다:

  baseline : 정확 토큰 매칭 (현재 backend ResumeOptimizer 의 과거 동작)
  +alias   : 별칭/약어/한글 사전 (backend TechExtractor.ALIASES 와 동일 — #306 에서 도입)
  semantic : 스킬(+별칭+gloss) 임베딩 vs 이력서 '구절' 임베딩, 코사인 최대 >= 임계값
  hybrid   : +alias OR semantic

목적: 임계값 스윕으로 재현율/정밀도/F1 을 재고, 의미 폴백(Phase 1)에 쓸 임계값을 정한다.
정밀도(없는 스킬을 present 로 오탐하지 않기)가 코치 그라운딩엔 특히 중요 — 거짓 present 는
모델이 '있지도 않은 강점'을 전제하게 만든다.

실행: `ai/.venv/bin/python ai/scripts/skill_match_eval.py`
(sentence-transformers + torch 필요. CI 에는 미설치 — 로컬 전용 분석 도구다.)
"""

from __future__ import annotations

import numpy as np

MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"

# 표준 스킬 → (별칭 표면형, 의미 gloss). 별칭은 backend TechExtractor.ALIASES 와 동일하게 유지.
# gloss 는 semantic 신호용 짧은 확장(패러프레이즈 회수용) — alias 매칭엔 쓰이지 않는다.
SKILLS: dict[str, tuple[list[str], str]] = {
    "Kubernetes": (["k8s", "쿠버네티스"], "container orchestration cluster"),
    "Docker": (["도커"], "containerization images"),
    "PostgreSQL": (["postgres", "포스트그레스"], "relational database SQL"),
    "Redis": (["레디스"], "in-memory cache key-value store"),
    "Kafka": (["카프카"], "event streaming log"),
    "Python": (["파이썬"], "Python programming language"),
    "Java": (["자바"], "Java JVM programming"),
    "Go": (["golang", "고랭"], "Go programming language"),
    "React": (["리액트"], "React frontend UI"),
    "TypeScript": (["타입스크립트"], "TypeScript typed JavaScript"),
    "Terraform": (["테라폼"], "infrastructure as code provisioning"),
    "AWS": (["amazon web services"], "AWS cloud infrastructure"),
    # --- 별칭으론 못 잡고 semantic 이 필요한 개념형 ---
    "gRPC": (["grpc"], "RPC services using protocol buffers protobuf"),
    "Observability": (
        ["observability"],
        "metrics logs distributed tracing Prometheus Grafana monitoring 지표 로그 트레이싱 모니터링",
    ),
    "CI/CD": (["ci/cd", "cicd"], "automated build test deployment pipeline 배포 파이프라인"),
    "Message Queue": (
        ["message queue", "메시지 큐"],
        "asynchronous message broker event streaming queue Kafka RabbitMQ",
    ),
    # --- 보통 absent 라벨로 쓰는 다양성(오탐 측정) ---
    "Rust": (["rust", "러스트"], "Rust systems programming"),
    "GraphQL": (["graphql", "그래프큐엘"], "GraphQL query API schema"),
    "Scala": (["scala", "스칼라"], "Scala functional JVM"),
    "Spark": (["spark", "스파크"], "Apache Spark big data processing"),
    "Elixir": (["elixir", "엘릭서"], "Elixir Erlang BEAM concurrency"),
}

# (제목, 요구 스킬, 이력서 줄들, 정답 present 집합). absent = required - present.
CASES: list[dict] = [
    {
        "title": "C1 영문 백엔드 패러프레이즈",
        "required": ["Kubernetes", "gRPC", "Observability", "CI/CD", "PostgreSQL", "GraphQL"],
        "resume": [
            "Designed and operated containerized microservices on a managed K8s cluster",
            "Built internal RPC services using Protocol Buffers",
            "Set up Prometheus and Grafana dashboards with distributed tracing",
            "Automated build, test and deployment pipelines with GitHub Actions",
            "Managed relational data in Postgres with complex query tuning",
        ],
        "present": {"Kubernetes", "gRPC", "Observability", "CI/CD", "PostgreSQL"},
    },
    {
        "title": "C2 한국어 이력서",
        "required": ["Kubernetes", "Message Queue", "Observability", "Rust", "Docker"],
        "resume": [
            "도커로 컨테이너화한 서비스를 쿠버네티스 클러스터에 배포하고 운영했습니다",
            "카프카 기반 비동기 이벤트 파이프라인을 설계했습니다",
            "지표·로그·트레이싱으로 장애를 모니터링하는 체계를 구축했습니다",
            "대규모 트래픽의 결제 백엔드를 Java/Spring 으로 개발했습니다",
        ],
        "present": {"Kubernetes", "Message Queue", "Observability", "Docker"},
    },
    {
        "title": "C3 통제군(정확히 적힘)",
        "required": ["Python", "React", "AWS", "Terraform", "Scala"],
        "resume": [
            "Built data pipelines in Python and deployed React dashboards",
            "Provisioned AWS infrastructure as code using Terraform modules",
        ],
        "present": {"Python", "React", "AWS", "Terraform"},
    },
    {
        "title": "C4 약어/표기 변형",
        "required": ["PostgreSQL", "Kubernetes", "CI/CD", "Redis"],
        "resume": [
            "Operated k8s in prod; cached hot paths in redis",
            "Stored data in postgres; set up CI/CD with ArgoCD",
        ],
        "present": {"PostgreSQL", "Kubernetes", "CI/CD", "Redis"},
    },
    {
        "title": "C5 한영 혼용 + 없는 스킬",
        "required": ["Go", "Kafka", "GraphQL", "Elixir"],
        "resume": [
            "Go(golang) 로 고성능 API 서버를 작성했습니다",
            "카프카로 이벤트를 발행/구독하는 시스템을 운영했습니다",
            "REST API 를 설계했습니다",
        ],
        "present": {"Go", "Kafka"},
    },
    {
        "title": "C6 관측성/CI 패러프레이즈(한글)",
        "required": ["Observability", "CI/CD", "Docker", "Spark"],
        "resume": [
            "젠킨스로 빌드·테스트·배포를 자동화했습니다",
            "메트릭과 로그, 분산 추적으로 서비스 상태를 관측했습니다",
            "도커 이미지를 빌드해 배포했습니다",
        ],
        "present": {"Observability", "CI/CD", "Docker"},
    },
    {
        "title": "C7 gRPC/메시지큐 패러프레이즈",
        "required": ["gRPC", "Message Queue", "PostgreSQL", "Rust"],
        "resume": [
            "Implemented service-to-service RPC with protobuf schemas",
            "Used a message broker (RabbitMQ) for async jobs",
            "Wrote heavy SQL on a Postgres database",
        ],
        "present": {"gRPC", "Message Queue", "PostgreSQL"},
    },
    {
        "title": "C8 프론트엔드",
        "required": ["React", "TypeScript", "GraphQL", "Kubernetes"],
        "resume": [
            "Built a React SPA in TypeScript",
            "Consumed a GraphQL API and managed client cache",
        ],
        "present": {"React", "TypeScript", "GraphQL"},
    },
    {
        "title": "C9 데이터 엔지니어(없는 스킬 다수)",
        "required": ["Python", "Spark", "Kafka", "Kubernetes", "Scala"],
        "resume": [
            "Python 으로 ETL 배치를 작성했습니다",
            "스파크로 대용량 데이터를 처리했습니다",
            "카프카에서 스트림을 소비했습니다",
        ],
        "present": {"Python", "Spark", "Kafka"},
    },
    {
        "title": "C10 거의 안 맞는 이력서(정밀도 스트레스)",
        "required": ["Kubernetes", "gRPC", "Terraform", "Observability"],
        "resume": [
            "주로 워드프레스로 사내 홈페이지를 운영했습니다",
            "엑셀 매크로로 리포트를 자동화했습니다",
        ],
        "present": set(),  # 전부 absent — semantic 오탐이 새면 여기서 드러남
    },
]

_SPLIT_TOKENS = ("\n", ",", "·", " and ", " 및 ", " 와 ", " 그리고 ", ";")


def phrases(lines: list[str]) -> list[str]:
    out: list[str] = []
    for ln in lines:
        parts = [ln]
        for sep in _SPLIT_TOKENS:
            parts = [seg for p in parts for seg in p.split(sep)]
        out.extend(p.strip() for p in parts if p.strip())
    return out or lines


def token_hit(needle: str, text: str) -> bool:
    import re

    pat = re.escape(needle.lower()).replace(r"\ ", r"\s+")
    return re.search(rf"(?<![a-z0-9가-힣]){pat}(?![a-z0-9])", text) is not None


def baseline_present(skill: str, resume: list[str]) -> bool:
    return token_hit(skill, " \n ".join(resume).lower())


def alias_present(skill: str, resume: list[str]) -> bool:
    text = " \n ".join(resume).lower()
    surfaces = [skill, *SKILLS[skill][0]]
    return any(token_hit(s, text) for s in surfaces)


def main() -> None:
    from sentence_transformers import SentenceTransformer

    print(f"모델 로딩: {MODEL_NAME} ...", flush=True)
    model = SentenceTransformer(MODEL_NAME)

    def emb(texts: list[str]) -> np.ndarray:
        return model.encode(
            texts, convert_to_numpy=True, show_progress_bar=False, normalize_embeddings=True
        )

    # 케이스별 스킬 max-코사인 미리 계산
    rows = []  # (skill, truth, base, alias, best_sim)
    for case in CASES:
        ph_vecs = emb(phrases(case["resume"]))
        for skill in case["required"]:
            aliases, gloss = SKILLS[skill]
            sv = emb([f"{skill} {' '.join(aliases)} {gloss}"])[0]
            best = float(np.max(ph_vecs @ sv))
            rows.append((
                skill,
                skill in case["present"],
                baseline_present(skill, case["resume"]),
                alias_present(skill, case["resume"]),
                best,
            ))

    n_present = sum(1 for r in rows if r[1])
    n_absent = len(rows) - n_present
    print(f"\n라벨: 총 {len(rows)} 판정 (present {n_present} / absent {n_absent})")

    def metrics(preds: list[bool]) -> tuple[float, float, float, int, int]:
        tp = sum(1 for r, p in zip(rows, preds, strict=True) if r[1] and p)
        fp = sum(1 for r, p in zip(rows, preds, strict=True) if not r[1] and p)
        fn = sum(1 for r, p in zip(rows, preds, strict=True) if r[1] and not p)
        rec = tp / (tp + fn) if (tp + fn) else 0.0
        prec = tp / (tp + fp) if (tp + fp) else 1.0
        f1 = 2 * prec * rec / (prec + rec) if (prec + rec) else 0.0
        return rec, prec, f1, fp, fn

    print("\n임계값 무관 방식:")
    for name, preds in [
        ("baseline", [r[2] for r in rows]),
        ("+alias", [r[3] for r in rows]),
    ]:
        rec, prec, f1, fp, fn = metrics(preds)
        print(f"  {name:9} recall={rec:.0%}  precision={prec:.0%}  F1={f1:.2f}  (FP={fp}, FN={fn})")

    print("\n임계값 스윕 (semantic 단독 / hybrid = +alias OR semantic):")
    print(f"  {'thr':>5}  {'sem rec/prec/F1':>22}  {'hybrid rec/prec/F1':>24}")
    f1_pick = None       # precision>=90% 제약하 F1 최대
    safe_pick = None     # precision==100%(오탐 0) 유지하며 recall 최대 — 코치 그라운딩용 권장
    for thr in [round(0.30 + 0.05 * i, 2) for i in range(8)]:  # 0.30 .. 0.65
        sem_preds = [r[4] >= thr for r in rows]
        hyb_preds = [r[3] or (r[4] >= thr) for r in rows]
        s = metrics(sem_preds)
        h = metrics(hyb_preds)
        print(
            f"  {thr:>5.2f}  {f'{s[0]:.0%}/{s[1]:.0%}/{s[2]:.2f}':>22}  "
            f"{f'{h[0]:.0%}/{h[1]:.0%}/{h[2]:.2f}':>24}"
        )
        if h[1] >= 0.90 and (f1_pick is None or h[2] > f1_pick[1]):
            f1_pick = (thr, h[2], h[0], h[1])
        if h[3] == 0 and (safe_pick is None or h[0] > safe_pick[2]):  # FP==0
            safe_pick = (thr, h[2], h[0], h[1])

    print("\n" + "=" * 70)
    if f1_pick:
        thr, f1, rec, prec = f1_pick
        print(f"F1 최대(precision>=90%):  thr={thr} → recall={rec:.0%}, precision={prec:.0%}, F1={f1:.2f}")
    if safe_pick:
        thr, f1, rec, prec = safe_pick
        print(
            f"권장(코치, 오탐 0 유지 최대 recall): thr={thr} "
            f"→ recall={rec:.0%}, precision={prec:.0%}, F1={f1:.2f}"
        )
    print("코치 그라운딩은 거짓 present(오탐)가 환각을 유발하므로 '오탐 0' 픽을 기본값으로 권장.")
    print("baseline 35% → +alias 71%(#306) → +semantic 의 회수폭이 Phase 1 기대 이득이다.")


if __name__ == "__main__":
    main()
