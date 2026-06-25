"""POST /internal/visa-guide — 청크 그라운딩 합성. OpenAI 호출은 httpx 목."""
from unittest.mock import AsyncMock
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings

client = TestClient(app)

def _mock_openai(monkeypatch, content: str):
    class _Resp:
        status_code = 200
        text = ""
        def json(self):
            return {"choices": [{"message": {"content": content}}]}
    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=_Resp())
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    monkeypatch.setattr("app.routes.visa_guide.httpx.AsyncClient", lambda *a, **k: mock_client)
    return mock_client

def test_returns_guide_text_grounded_on_chunks(monkeypatch):
    monkeypatch.setattr(settings, "openai_api_key", "test-key")
    mock_client = _mock_openai(monkeypatch, "독일은 Blue Card 로 한국 개발자 스폰서가 흔합니다.")
    body = {
        "country": "de",
        "visa_status": "sponsors",
        "job_meta": {"title": "Backend Engineer", "seniority": "senior"},
        "chunks": [
            {"section": "visa_types", "content": "EU Blue Card 는 고숙련 취업비자.",
             "source_url": "https://www.make-it-in-germany.com", "retrieved_at": "2026-06-25"}
        ],
    }
    resp = client.post("/internal/visa-guide", json=body)
    assert resp.status_code == 200
    data = resp.json()
    assert data["guide"].startswith("독일")
    assert data["engine"] == settings.openai_model
    sent = mock_client.post.call_args.kwargs["json"]
    user_msg = sent["messages"][-1]["content"]
    assert "EU Blue Card" in user_msg

def test_missing_api_key_returns_503(monkeypatch):
    monkeypatch.setattr(settings, "openai_api_key", "")
    resp = client.post("/internal/visa-guide", json={"country": "de", "chunks": []})
    assert resp.status_code == 503
