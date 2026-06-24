"""normalize_tech_tags: 외부/보드 태그에서 기술스택만 남기는지 검증."""
from dev_jobs_core.analyzers.stack import extract_tech, normalize_tech_tags


def test_keeps_real_tech_case_insensitive():
    assert normalize_tech_tags(["React", "AWS", "Kotlin"]) == ["react", "aws", "kotlin"]


def test_drops_non_tech_labels():
    # arbeitnow/remoteok 가 흘리는 비기술 라벨들
    tags = ["remote", "management", "digital nomad", "fintech", "senior", "education", "it"]
    assert normalize_tech_tags(tags) == []


def test_mixed_keeps_only_tech():
    assert normalize_tech_tags(["react", "remote", "senior", "aws"]) == ["react", "aws"]


def test_alias_normalization():
    assert normalize_tech_tags(["ReactJS", "node", "Vue.js", "tailwindcss"]) == [
        "react", "node.js", "vue", "tailwind",
    ]


def test_dedup_preserves_order():
    assert normalize_tech_tags(["aws", "AWS", "react", "reactjs"]) == ["aws", "react"]


def test_empty_and_none():
    assert normalize_tech_tags([]) == []
    assert normalize_tech_tags(None) == []
    assert normalize_tech_tags(["", "  "]) == []


def test_all_non_tech_returns_empty_for_fallback():
    # 호출부(transform)가 빈 결과를 보고 본문 extract_tech 로 폴백할 수 있어야 함
    assert normalize_tech_tags(["software development", "team leader"]) == []


def test_extract_finds_enterprise_platforms():
    found = set(extract_tech("We run Salesforce, ServiceNow and SAP ABAP in production."))
    assert {"salesforce", "servicenow", "sap", "abap"} <= found


def test_extract_finds_gamedev_and_design_tools():
    found = set(extract_tech("Shipped games in Unity and Unreal Engine; UI built in Figma."))
    assert {"unity", "unreal engine", "figma"} <= found


def test_extract_new_keyword_boundary_no_false_positive():
    # 'unity' 가 community/opportunity/immunity 안에서, 'sap' 가 sapling 안에서 매칭되면 안 됨
    found = set(extract_tech("Our community values opportunity and immunity. The sapling grew."))
    assert "unity" not in found
    assert "sap" not in found


def test_normalize_keeps_new_platforms():
    assert normalize_tech_tags(["Salesforce", "ServiceNow", "Shopify"]) == [
        "salesforce", "servicenow", "shopify",
    ]


def test_extract_finds_ai_stack_richly():
    # AI 엔지니어 공고가 'llm' 하나만 잡히던 문제 — 생성형/에이전트/RAG/벡터DB/서빙 어휘 인식.
    desc = (
        "Join our AI Platform team to build LLM and AI agent infrastructure. "
        "You'll work on RAG pipelines, prompt engineering, fine-tuning, and embeddings, "
        "serving models with vLLM, orchestrating with LangGraph and LlamaIndex, "
        "storing vectors in Pinecone (vector database), and running MLflow for MLOps."
    )
    found = set(extract_tech(desc))
    assert {
        "llm", "ai agent", "rag", "prompt engineering", "fine-tuning", "embeddings",
        "vllm", "langgraph", "llamaindex", "pinecone", "vector database", "mlflow", "mlops",
    } <= found


def test_extract_generative_ai_and_providers():
    found = set(extract_tech("Generative AI / GenAI work with Claude (Anthropic) and Mistral models."))
    assert {"generative ai", "genai", "claude", "anthropic", "mistral"} <= found


def test_extract_ai_terms_no_false_positives():
    # 'ai agent'/'agentic' 만 인식하고 일반 'agent'(보험/유저 에이전트)는 안 잡아야 함.
    # 'vector' 단독(수학/그래픽)도 'vector database/search' 가 아니면 안 잡아야 함.
    found = set(extract_tech("The insurance agent used a vector graphic in the user agent string."))
    assert "ai agent" not in found
    assert "ai agents" not in found
    assert "agentic" not in found
    assert "vector database" not in found
    assert "vector search" not in found
