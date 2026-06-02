from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.routes.translate import _api_url

client = TestClient(app)


def test_api_url_free_vs_pro():
    # Free 플랜 키(':fx')는 api-free, 그 외는 pro 엔드포인트
    assert _api_url("abc-123:fx") == "https://api-free.deepl.com/v2/translate"
    assert _api_url("abc-123") == "https://api.deepl.com/v2/translate"


def test_missing_key_returns_503(monkeypatch):
    # DeepL 키 미설정 시 503 (번역 미설정 안내)
    monkeypatch.setattr(settings, "deepl_api_key", "", raising=False)
    monkeypatch.delenv("DEEPL_API_KEY", raising=False)
    r = client.post("/internal/translate", json={"title": "Engineer", "description": "About us"})
    assert r.status_code == 503


def test_empty_input_returns_400(monkeypatch):
    # 키는 있는데 입력이 모두 비면 400
    monkeypatch.setattr(settings, "deepl_api_key", "test-key:fx", raising=False)
    r = client.post("/internal/translate", json={"title": "", "description": ""})
    assert r.status_code == 400


def test_description_too_long_is_422():
    r = client.post("/internal/translate", json={"description": "x" * 20_001})
    assert r.status_code == 422
