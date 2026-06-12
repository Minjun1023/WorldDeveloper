"""normalize_tech_tags: 외부/보드 태그에서 기술스택만 남기는지 검증."""
from dev_jobs_core.analyzers.stack import normalize_tech_tags


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
