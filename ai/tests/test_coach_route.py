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


def test_no_job_context_system_prompt_forbids_inventing_keywords(monkeypatch):
    # 회귀: 공고 미첨부(#255 이후 가능)인데 모델이 '공고 맞춤 키워드'를 지어내던 환각.
    # 시스템 프롬프트가 '공고 없으면 추측 금지 + 공고 첨부 안내'를 담아야 하고,
    # 빈 컨텍스트는 빈 공고 컨텍스트로 오인되지 않게 '없음'으로 명시되어야 한다.
    monkeypatch.setattr(settings, "openai_api_key", "k")
    mock_post = AsyncMock(return_value=_mock_openai("이력서 기준 일반 피드백입니다."))
    with patch("httpx.AsyncClient.post", mock_post):
        r = client.post("/internal/coach-chat", json={
            "context": "",
            "resume": "Go developer 5y",
            "messages": [{"role": "user", "content": "이 공고에 맞는 키워드 알려줘"}],
        })
    assert r.status_code == 200
    sent = mock_post.call_args.kwargs["json"]["messages"]
    system_prompt = sent[0]["content"]
    assert "does NOT include a specific job posting" in system_prompt
    assert "attach a target job posting" in system_prompt
    assert "공고/추가 컨텍스트 없음" in sent[1]["content"]
