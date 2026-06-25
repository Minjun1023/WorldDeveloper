"""build_embed_text — 임베딩 입력 텍스트 구성 단위 테스트 (모델 로드 불필요)."""
from __future__ import annotations

from dev_jobs_core.recommender.embeddings import build_embed_text


def test_title_and_skills_front_loaded():
    text = build_embed_text(
        "Senior Data Engineer",
        ["Spark", "Airflow", "Python"],
        "About Acme: we are a fast growing company. You will build pipelines.",
    )
    # 제목이 맨 앞, 그 다음 Skills 앵커 — 둘 다 모델 128토큰 윈도우 안에 들어오게.
    assert text.startswith("Senior Data Engineer. Skills: Spark, Airflow, Python.")
    assert "About Acme" in text


def test_skills_anchor_matches_query_side():
    # 쿼리(프로필) 측과 동일한 'Skills: a, b' 앵커 형태여야 한다.
    text = build_embed_text("Backend Engineer", ["Java", "Spring"], None)
    assert text == "Backend Engineer. Skills: Java, Spring"


def test_description_truncated_to_400_chars():
    long_desc = "x" * 1000
    text = build_embed_text("Engineer", None, long_desc)
    # "Engineer. " + 400 x's
    assert text == "Engineer. " + "x" * 400


def test_whitespace_collapsed():
    text = build_embed_text("Site   Reliability\nEngineer", None, "line one\n\n   line two")
    assert text == "Site Reliability Engineer. line one line two"


def test_empty_inputs():
    assert build_embed_text(None, None, None) == ""
    assert build_embed_text(None, [], "") == ""


def test_skips_missing_parts():
    assert build_embed_text(None, ["Go"], None) == "Skills: Go"
    assert build_embed_text("Engineer", None, None) == "Engineer"
