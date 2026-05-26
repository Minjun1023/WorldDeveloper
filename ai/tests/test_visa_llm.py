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
    """Valid JSON {"status":"sponsors","reason":"비자 지원 명시"} → ("sponsors", ["AI: 비자 지원 명시"])"""
    monkeypatch.setattr(settings, "openai_api_key", "test-key")

    mock_resp = _make_mock_response({"status": "sponsors", "reason": "비자 지원 명시"})

    mock_post = AsyncMock(return_value=mock_resp)
    mock_client = AsyncMock()
    mock_client.post = mock_post
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("app.etl.visa_llm.httpx.AsyncClient", return_value=mock_client):
        result = await classify_visa_llm("Senior Engineer", "We are looking for a senior engineer.")

    assert result == ("sponsors", ["AI: 비자 지원 명시"])


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
