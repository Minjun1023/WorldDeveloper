import os
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.routes.application_kit import _parse_kit_json

client = TestClient(app)

def test_missing_api_key_returns_503(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.setattr("app.routes.application_kit.settings", type("S", (), {"openai_api_key": "", "openai_model": "gpt-4o-mini"}))
    r = client.post("/internal/application-kit", json={"jd": "x", "resume": "y", "job_meta": {}, "skill_gap": {}})
    assert r.status_code == 503

def test_parse_kit_json_extracts_fields():
    raw = '{"fit_summary":"좋음","skill_strategy":"보완","cover_letter":"안녕하세요","interview_questions":["Q1","Q2"]}'
    kit = _parse_kit_json(raw)
    assert kit["fit_summary"] == "좋음"
    assert kit["interview_questions"] == ["Q1", "Q2"]

def test_parse_kit_json_bad_input_raises():
    with pytest.raises(ValueError):
        _parse_kit_json("not json")
