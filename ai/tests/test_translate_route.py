from fastapi.testclient import TestClient

from app import translate_engine as te
from app.config import settings
from app.main import app

client = TestClient(app)


class _FakeResp:
    status_code = 200

    def json(self):
        return {"translations": [{"text": "엔지니어"}, {"text": "<p>소개</p>"}]}


class _FakeClient:
    def __init__(self, *a, **k):
        self.last = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def post(self, url, headers=None, json=None):
        self.last = {"url": url, "headers": headers, "json": json}
        return _FakeResp()


def test_deepl_translates_and_preserves_html(monkeypatch):
    monkeypatch.setattr(settings, "deepl_api_key", "abc:fx", raising=False)
    monkeypatch.setattr(te.httpx, "AsyncClient", lambda *a, **k: _FakeClient())
    r = client.post("/internal/translate", json={"title": "Engineer", "description": "<p>About</p>"})
    assert r.status_code == 200
    data = r.json()
    assert data["engine"] == "deepl"
    assert data["title"] == "엔지니어"
    assert data["description"] == "<p>소개</p>"


def test_missing_key_returns_503(monkeypatch):
    # DEEPL_API_KEY 미설정 시 503 (번역 미설정 안내)
    monkeypatch.setattr(settings, "deepl_api_key", "", raising=False)
    monkeypatch.delenv("DEEPL_API_KEY", raising=False)
    r = client.post("/internal/translate", json={"title": "Engineer", "description": "About"})
    assert r.status_code == 503


def test_empty_input_returns_400(monkeypatch):
    # 입력이 모두 비면 400 (DeepL 호출 전에 차단)
    monkeypatch.setattr(settings, "deepl_api_key", "abc:fx", raising=False)
    r = client.post("/internal/translate", json={"title": "", "description": ""})
    assert r.status_code == 400


def test_description_too_long_is_422():
    r = client.post("/internal/translate", json={"description": "x" * 60_001})
    assert r.status_code == 422
