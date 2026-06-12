"""공고 description 에서 기술 스택 키워드를 추출하고 이력서와 매칭.

핵심 아이디어: 알려진 기술 키워드 사전을 두고, description 에서 그 단어를
boundary 단위로 검색한다. 단순하지만 false positive 가 적다.
"""
from __future__ import annotations
import re

# 자주 등장하는 기술 키워드 (대소문자 무시).
# 운영하면서 계속 확장할 수 있도록 평탄 리스트로 둠.
TECH_KEYWORDS = [
    # 언어
    "python", "javascript", "typescript", "go", "golang", "rust", "java", "kotlin",
    "swift", "ruby", "php", "scala", "elixir", "clojure", "haskell", "c++", "c#",
    "objective-c", "dart", "r", "perl", "lua", "julia",
    # 프론트엔드
    "react", "vue", "angular", "svelte", "next.js", "nuxt", "remix", "astro",
    "redux", "tailwind", "webpack", "vite", "graphql",
    # 백엔드
    "node.js", "django", "flask", "fastapi", "rails", "spring", "spring boot",
    "express", "nestjs", ".net", "asp.net", "laravel", "phoenix",
    # 데이터/ML
    "pytorch", "tensorflow", "keras", "scikit-learn", "pandas", "numpy",
    "spark", "hadoop", "airflow", "dbt", "snowflake", "bigquery", "databricks",
    "kafka", "redshift", "tableau", "looker",
    # 데이터베이스
    "postgresql", "postgres", "mysql", "mongodb", "redis", "elasticsearch",
    "dynamodb", "cassandra", "sqlite", "neo4j", "clickhouse",
    # 인프라/DevOps
    "aws", "gcp", "azure", "kubernetes", "k8s", "docker", "terraform", "ansible",
    "jenkins", "github actions", "gitlab ci", "circleci", "prometheus", "grafana",
    "istio", "helm", "argocd",
    # 모바일
    "ios", "android", "react native", "flutter", "swiftui", "jetpack compose",
    # 기타
    "linux", "git", "rest api", "grpc", "microservices", "serverless", "lambda",
    "ci/cd", "agile", "scrum",
    # 개념/아키텍처 (구문 위주라 오탐 적음)
    "machine learning", "deep learning", "reinforcement learning", "computer vision",
    "natural language processing", "distributed systems", "data engineering",
    "data pipeline", "data warehouse", "data lake", "event-driven", "message queue",
    "observability", "mlops", "devops", "sre",
    # AI/ML
    "nlp", "llm", "rag", "hugging face", "langchain", "openai", "cuda",
    # 데이터 (추가)
    "sql", "nosql", "flink", "presto", "trino", "hive", "dagster", "prefect", "iceberg",
    # 언어 (추가)
    "bash", "shell", "solidity", "groovy", "matlab",
    # 프론트엔드 (추가)
    "html", "css", "sass", "scss", "jquery", "three.js", "webgl", "storybook",
    "jest", "cypress", "playwright", "esbuild",
    # 백엔드 프레임워크 (추가)
    "ktor", "quarkus", "micronaut", "actix", "fastify", "symfony",
    # 데이터베이스 (추가)
    "mariadb", "cockroachdb", "influxdb", "memcached", "rabbitmq", "couchbase",
    "supabase", "firebase",
    # 인프라/클라우드 (추가)
    "nginx", "envoy", "datadog", "splunk", "opentelemetry", "pulumi", "vault",
    "consul", "s3", "ec2", "eks", "gke", "rds", "fargate", "cloudflare", "vercel",
    "netlify", "heroku", "gitops", "kafka streams",
    # 기타 (추가)
    "websocket", "oauth", "jwt", "webassembly", "wasm", "opengl",
]


def extract_tech(text: str) -> list[str]:
    """text 에서 등장하는 기술 키워드를 모두 추출 (소문자 정규화)."""
    if not text:
        return []
    text_lower = text.lower()
    found: list[str] = []
    seen: set[str] = set()
    for kw in TECH_KEYWORDS:
        # 단어 경계로 매칭 (e.g. "go" 가 "google" 안에서 매칭되지 않게)
        # 단, "c++" 처럼 특수문자 포함된 경우는 boundary 가 안 먹으므로 별도 처리
        if re.search(r"[^\w]" + re.escape(kw) + r"[^\w]|^" + re.escape(kw) + r"[^\w]|[^\w]" + re.escape(kw) + r"$|^" + re.escape(kw) + r"$",
                     f" {text_lower} "):
            if kw not in seen:
                seen.add(kw)
                found.append(kw)
    return found


# 큐레이션 어휘 집합(소문자) + vocab 에 없는 흔한 외부 태그 변형 → canonical.
# (golang·k8s·postgres 등은 이미 vocab 에 있어 직접 매칭되므로 별칭 불필요.)
_TECH_SET = {kw.lower() for kw in TECH_KEYWORDS}
_TECH_ALIASES = {
    "reactjs": "react", "react.js": "react",
    "nodejs": "node.js", "node": "node.js",
    "vuejs": "vue", "vue.js": "vue",
    "tailwindcss": "tailwind",
}


def normalize_tech_tags(tags: list[str]) -> list[str]:
    """외부/보드 태그(arbeitnow·remoteok·jsearch 등)에서 기술스택만 남긴다.

    'remote'·'management'·'digital nomad'·'fintech' 같은 비기술 라벨을 제거하고,
    큐레이션된 TECH_KEYWORDS 에 매칭되는 태그만 (소문자·별칭 정규화) 보존한다.
    대소문자 무시, 중복 제거, 순서 보존. 매칭 0개면 빈 리스트(호출부가 본문 추출로 폴백).
    """
    out: list[str] = []
    seen: set[str] = set()
    for raw in tags or []:
        t = (raw or "").strip().lower()
        if not t:
            continue
        canon = _TECH_ALIASES.get(t, t)
        if canon in _TECH_SET and canon not in seen:
            seen.add(canon)
            out.append(canon)
    return out


def match_resume(resume_text: str, job_description: str) -> dict:
    """이력서와 공고를 비교해 스택 갭 분석."""
    job_stack = set(extract_tech(job_description))
    resume_stack = set(extract_tech(resume_text))

    matched = sorted(job_stack & resume_stack)
    missing = sorted(job_stack - resume_stack)
    extra = sorted(resume_stack - job_stack)

    ratio = round(len(matched) / len(job_stack), 2) if job_stack else None

    return {
        "job_requires": sorted(job_stack),
        "matched": matched,
        "missing": missing,
        "resume_extras": extra,
        "match_ratio": ratio,
    }
