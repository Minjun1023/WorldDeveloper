import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.routes import translate as tr

client = TestClient(app)


class _FakeResp:
    status_code = 200

    def json(self):
        return {"translatedText": "OK"}


class _FakeClient:
    def __init__(self):
        self.last_payload = None

    async def post(self, url, json):
        self.last_payload = json
        return _FakeResp()


@pytest.mark.asyncio
async def test_lt_translate_passes_format_html():
    c = _FakeClient()
    out = await tr._lt_translate(c, "http://x", "", "ko", "<p>hi</p>", "html")
    assert out == "OK"
    assert c.last_payload["format"] == "html"
    assert c.last_payload["q"] == "<p>hi</p>"


@pytest.mark.asyncio
async def test_lt_translate_default_format_text():
    c = _FakeClient()
    await tr._lt_translate(c, "http://x", "", "ko", "plain title")
    assert c.last_payload["format"] == "text"


def test_missing_url_returns_503(monkeypatch):
    # LibreTranslate URL 미설정 시 503 (번역 미설정 안내)
    monkeypatch.setattr(settings, "libretranslate_url", "", raising=False)
    monkeypatch.delenv("LIBRETRANSLATE_URL", raising=False)
    r = client.post("/internal/translate", json={"title": "Engineer", "description": "About us"})
    assert r.status_code == 503


def test_empty_input_returns_400(monkeypatch):
    # URL 은 있는데 입력이 모두 비면 400 (HTTP 호출 전에 차단)
    monkeypatch.setattr(settings, "libretranslate_url", "http://localhost:5050", raising=False)
    r = client.post("/internal/translate", json={"title": "", "description": ""})
    assert r.status_code == 400


def test_description_too_long_is_422():
    r = client.post("/internal/translate", json={"description": "x" * 60_001})
    assert r.status_code == 422
