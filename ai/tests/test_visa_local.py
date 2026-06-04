import asyncio

import app.etl.visa_local as vl
from app.config import settings


def test_local_hit_returns_without_llm(monkeypatch):
    monkeypatch.setattr(vl, "classify_visa_local", lambda t, d: ("sponsors", ["we sponsor"]))

    async def fail_llm(t, d):  # 호출되면 실패
        raise AssertionError("LLM should not be called when local hits")

    monkeypatch.setattr(vl, "classify_visa_llm", fail_llm)
    assert asyncio.run(vl.resolve_visa("t", "d")) == ("sponsors", ["we sponsor"])


def test_local_abstain_falls_back_to_llm_when_key(monkeypatch):
    monkeypatch.setattr(vl, "classify_visa_local", lambda t, d: ("unclear", []))
    monkeypatch.setattr(settings, "openai_api_key", "key")

    async def llm(t, d):
        return ("no_sponsor", ["must have work auth"])

    monkeypatch.setattr(vl, "classify_visa_llm", llm)
    assert asyncio.run(vl.resolve_visa("t", "d")) == ("no_sponsor", ["must have work auth"])


def test_local_abstain_no_key_returns_unclear(monkeypatch):
    monkeypatch.setattr(vl, "classify_visa_local", lambda t, d: ("unclear", []))
    monkeypatch.setattr(settings, "openai_api_key", "")
    assert asyncio.run(vl.resolve_visa("t", "d")) == ("unclear", [])


def test_model_unavailable_falls_back_to_llm_when_key(monkeypatch):
    monkeypatch.setattr(vl, "classify_visa_local", lambda t, d: None)
    monkeypatch.setattr(settings, "openai_api_key", "key")

    async def llm(t, d):
        return ("sponsors", ["visa sponsorship offered"])

    monkeypatch.setattr(vl, "classify_visa_llm", llm)
    assert asyncio.run(vl.resolve_visa("t", "d")) == ("sponsors", ["visa sponsorship offered"])


def test_model_unavailable_no_key_returns_none(monkeypatch):
    monkeypatch.setattr(vl, "classify_visa_local", lambda t, d: None)
    monkeypatch.setattr(settings, "openai_api_key", "")
    assert asyncio.run(vl.resolve_visa("t", "d")) is None
