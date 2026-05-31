"""Tests for classify_visa_llm — monkeypatches httpx.AsyncClient.post."""
from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.config import settings
from app.etl.visa_llm import classify_visa_llm


def _make_mock_response(payload: dict, status_code: int = 200) -> MagicMock:
    """Build a mock httpx.Response-like object."""
    content = json.dumps({"choices": [{"message": {"content": json.dumps(payload)}}]})
    mock_resp = MagicMock()
    mock_resp.status_code = status_code
    mock_resp.json.return_value = json.loads(content)
    mock_resp.text = content
    return mock_resp


@pytest.mark.asyncio
async def test_valid_sponsors_response(monkeypatch):
    """Valid JSON with reason verbatim in description → ("sponsors", ["AI: we offer visa sponsorship"])"""
    monkeypatch.setattr(settings, "openai_api_key", "test-key")

    mock_resp = _make_mock_response({"status": "sponsors", "reason": "we offer visa sponsorship"})

    mock_post = AsyncMock(return_value=mock_resp)
    mock_client = AsyncMock()
    mock_client.post = mock_post
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("app.etl.visa_llm.httpx.AsyncClient", return_value=mock_client):
        result = await classify_visa_llm(
            "Senior Engineer",
            "We are looking for a senior engineer. We offer visa sponsorship for qualified candidates.",
        )

    assert result == ("sponsors", ["AI: we offer visa sponsorship"])


@pytest.mark.asyncio
async def test_no_key_returns_none(monkeypatch):
    """When OPENAI_API_KEY is absent, returns None without making any HTTP call."""
    monkeypatch.setattr(settings, "openai_api_key", "")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    result = await classify_visa_llm("Engineer", "Some description text here.")
    assert result is None


@pytest.mark.asyncio
async def test_invalid_status_returns_none(monkeypatch):
    """When LLM returns an unknown status value, returns None."""
    monkeypatch.setattr(settings, "openai_api_key", "test-key")

    mock_resp = _make_mock_response({"status": "unknown_value", "reason": "이상한 값"})

    mock_post = AsyncMock(return_value=mock_resp)
    mock_client = AsyncMock()
    mock_client.post = mock_post
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("app.etl.visa_llm.httpx.AsyncClient", return_value=mock_client):
        result = await classify_visa_llm("Engineer", "Some description text here.")

    assert result is None


@pytest.mark.asyncio
async def test_ungrounded_reason_returns_unclear(monkeypatch):
    """Grounding gate: no_sponsor reason not present in description → ("unclear", [])."""
    monkeypatch.setattr(settings, "openai_api_key", "test-key")

    mock_resp = _make_mock_response(
        {"status": "no_sponsor", "reason": "must be authorized to work in the US"}
    )

    mock_post = AsyncMock(return_value=mock_resp)
    mock_client = AsyncMock()
    mock_client.post = mock_post
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("app.etl.visa_llm.httpx.AsyncClient", return_value=mock_client):
        result = await classify_visa_llm(
            "Engineer",
            "We are a remote-friendly global company hiring across many countries.",
        )

    assert result == ("unclear", [])


@pytest.mark.asyncio
async def test_grounded_but_not_visa_relevant_returns_unclear(monkeypatch):
    """Relevance gate: reason IS present in description (grounded) but contains no visa keyword → ("unclear", [])."""
    monkeypatch.setattr(settings, "openai_api_key", "test-key")

    # The reason is verbatim in the description (grounding passes) but is about language
    # requirements, not visa/work-authorization — relevance gate must reject it.
    description = (
        "Wir suchen einen erfahrenen Entwickler. "
        "Gute Deutschkenntnisse sind Voraussetzung. "
        "Remote-Arbeit ist moeglich."
    )
    mock_resp = _make_mock_response(
        {"status": "no_sponsor", "reason": "Gute Deutschkenntnisse sind Voraussetzung"}
    )

    mock_post = AsyncMock(return_value=mock_resp)
    mock_client = AsyncMock()
    mock_client.post = mock_post
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("app.etl.visa_llm.httpx.AsyncClient", return_value=mock_client):
        result = await classify_visa_llm("Software Engineer", description)

    assert result == ("unclear", [])


@pytest.mark.asyncio
async def test_retries_on_429_then_succeeds(monkeypatch):
    """429(rate limit) 시 백오프 후 재시도 → 다음 200 응답으로 성공."""
    monkeypatch.setattr(settings, "openai_api_key", "test-key")

    resp_429 = MagicMock()
    resp_429.status_code = 429
    resp_429.text = "rate limited"
    resp_429.headers = {}
    resp_200 = _make_mock_response({"status": "sponsors", "reason": "we offer visa sponsorship"})

    mock_post = AsyncMock(side_effect=[resp_429, resp_200])
    mock_client = AsyncMock()
    mock_client.post = mock_post
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with (
        patch("app.etl.visa_llm.httpx.AsyncClient", return_value=mock_client),
        patch("app.etl.visa_llm.asyncio.sleep", AsyncMock()),
    ):
        result = await classify_visa_llm(
            "Senior Engineer",
            "We offer visa sponsorship for qualified candidates.",
        )

    assert result == ("sponsors", ["AI: we offer visa sponsorship"])
    assert mock_post.call_count == 2


@pytest.mark.asyncio
async def test_gives_up_after_repeated_429(monkeypatch):
    """429 가 계속되면 재시도 한도 후 None 반환(무한 루프 방지)."""
    monkeypatch.setattr(settings, "openai_api_key", "test-key")

    resp_429 = MagicMock()
    resp_429.status_code = 429
    resp_429.text = "rate limited"
    resp_429.headers = {}

    mock_post = AsyncMock(return_value=resp_429)
    mock_client = AsyncMock()
    mock_client.post = mock_post
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with (
        patch("app.etl.visa_llm.httpx.AsyncClient", return_value=mock_client),
        patch("app.etl.visa_llm.asyncio.sleep", AsyncMock()),
    ):
        result = await classify_visa_llm("Engineer", "Some description text here.")

    assert result is None
    assert mock_post.call_count >= 2  # 초기 시도 + 재시도
