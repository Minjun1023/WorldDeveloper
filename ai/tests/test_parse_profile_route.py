from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_rules_path_no_llm():
    r = client.post("/internal/parse-profile", json={"text": "3년차 백엔드 Go Python 베를린 비자"})
    assert r.status_code == 200
    body = r.json()
    assert body["source"] == "rules"
    assert body["sufficient"] is True
    assert "Go" in body["profile"]["skills"]


def test_too_long_is_400():
    r = client.post("/internal/parse-profile", json={"text": "x" * 201})
    assert r.status_code == 422  # pydantic max_length


def test_sanitize_llm_drops_hallucinated_values():
    from app.routes.parse_profile import _sanitize_llm

    cleaned = _sanitize_llm({
        "seniority": "god-tier",          # 비정상 enum → 제거
        "remote_preference": "teleport",  # 비정상 enum → 제거
        "years_experience": -5,           # 음수 → 제거
        "desired_salary_usd": 99_999_999_999,  # 비현실 → 제거
        "skills": ["python", "", 123, "go"],   # 빈/비문자 제거
    })
    assert "seniority" not in cleaned
    assert "remote_preference" not in cleaned
    assert "years_experience" not in cleaned
    assert "desired_salary_usd" not in cleaned
    assert cleaned["skills"] == ["python", "go"]


def test_sanitize_llm_keeps_valid_values():
    from app.routes.parse_profile import _sanitize_llm

    cleaned = _sanitize_llm({
        "seniority": "senior", "remote_preference": "remote",
        "years_experience": 6, "desired_salary_usd": 120000,
    })
    assert cleaned["seniority"] == "senior"
    assert cleaned["years_experience"] == 6
    assert cleaned["desired_salary_usd"] == 120000
