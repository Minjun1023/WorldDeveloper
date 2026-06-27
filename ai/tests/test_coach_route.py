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


def test_model_is_configurable_via_settings(monkeypatch):
    # #4: 모델을 코드 상수 대신 settings.openai_model 로 — env(OPENAI_MODEL)로 교체 가능.
    monkeypatch.setattr(settings, "openai_api_key", "k")
    monkeypatch.setattr(settings, "openai_model", "gpt-4o")
    mock_post = AsyncMock(return_value=_mock_openai("ok"))
    with patch("httpx.AsyncClient.post", mock_post):
        r = client.post("/internal/coach-chat", json={
            "context": "", "resume": "r", "messages": [{"role": "user", "content": "hi"}],
        })
    assert r.status_code == 200
    assert mock_post.call_args.kwargs["json"]["model"] == "gpt-4o"
    assert r.json()["engine"] == "gpt-4o"


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


def test_stream_endpoint_yields_content_deltas(monkeypatch):
    # 스트리밍: OpenAI SSE 델타를 평문 청크로 흘려 합치면 전체 답변이 된다.
    monkeypatch.setattr(settings, "openai_api_key", "k")

    class _FakeStream:
        status_code = 200

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def aiter_lines(self):
            for chunk in ["안녕", "하세요"]:
                yield "data: " + json.dumps({"choices": [{"delta": {"content": chunk}}]})
            yield "data: [DONE]"

        async def aread(self):
            return b""

    def _fake_stream(self, method, url, **kwargs):
        return _FakeStream()

    monkeypatch.setattr("httpx.AsyncClient.stream", _fake_stream)
    with client.stream(
        "POST",
        "/internal/coach-chat-stream",
        json={"context": "", "resume": "r", "messages": [{"role": "user", "content": "hi"}]},
    ) as r:
        assert r.status_code == 200
        body = "".join(part for part in r.iter_text())
    assert body == "안녕하세요"


def test_stream_endpoint_upstream_error_yields_message(monkeypatch):
    # 업스트림 오류(예: 429)는 StreamingResponse 시작 후라 상태코드로 못 알린다.
    # 빈 응답으로 끝내 '무에러 빈 답변'이 되는 대신, 사용자용 한국어 오류 문구를 흘려야 함.
    monkeypatch.setattr(settings, "openai_api_key", "k")

    class _FailStream:
        status_code = 429

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def aiter_lines(self):
            if False:  # 본문 없음 — non-200 이라 델타 루프 진입 전 종료
                yield ""

        async def aread(self):
            return b"rate limited"

    monkeypatch.setattr("httpx.AsyncClient.stream", lambda self, method, url, **kw: _FailStream())
    with client.stream(
        "POST",
        "/internal/coach-chat-stream",
        json={"context": "", "resume": "r", "messages": [{"role": "user", "content": "hi"}]},
    ) as r:
        assert r.status_code == 200  # 스트림은 이미 200 으로 시작됨
        body = "".join(part for part in r.iter_text())
    assert "다시 시도" in body  # 빈 응답이 아니라 오류 안내가 전달됨


def test_stream_endpoint_no_key_returns_503(monkeypatch):
    monkeypatch.setattr(settings, "openai_api_key", "")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    r = client.post(
        "/internal/coach-chat-stream",
        json={"context": "", "resume": "r", "messages": [{"role": "user", "content": "hi"}]},
    )
    assert r.status_code == 503
