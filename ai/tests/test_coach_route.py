"""Tests for /internal/coach-chat — monkeypatches httpx.AsyncClient.post."""
from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from app.config import settings
from app.main import app

client = TestClient(app)


def _mock_openai(reply: str) -> MagicMock:
    content = json.dumps({"choices": [{"message": {"content": reply}}]})
    m = MagicMock()
    m.status_code = 200
    m.json.return_value = json.loads(content)
    m.text = content
    return m


def test_no_key_returns_503(monkeypatch):
    monkeypatch.setattr(settings, "openai_api_key", "")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    r = client.post("/internal/coach-chat", json={"context": "ctx", "resume": "r", "messages": [{"role": "user", "content": "hi"}]})
    assert r.status_code == 503


def test_empty_messages_returns_400(monkeypatch):
    monkeypatch.setattr(settings, "openai_api_key", "k")
    r = client.post("/internal/coach-chat", json={"context": "ctx", "resume": "r", "messages": []})
    assert r.status_code == 400


def test_valid_returns_reply(monkeypatch):
    monkeypatch.setattr(settings, "openai_api_key", "k")
    mock_post = AsyncMock(return_value=_mock_openai("이력서의 Go 경험을 맨 위로 올리세요."))
    with patch("httpx.AsyncClient.post", mock_post):
        r = client.post("/internal/coach-chat", json={
            "context": "JD: Go backend. present=[go] missing=[kafka]",
            "resume": "Go developer 5y",
            "messages": [{"role": "user", "content": "이 공고에 맞게 어떻게 고칠까요?"}],
        })
    assert r.status_code == 200
    assert "Go" in r.json()["reply"]
    sent = mock_post.call_args.kwargs["json"]["messages"]
    assert sent[0]["role"] == "system"
    assert any(m["content"] == "이 공고에 맞게 어떻게 고칠까요?" for m in sent)
