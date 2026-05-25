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
