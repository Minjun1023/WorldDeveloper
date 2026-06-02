from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.routes.translate import MAX_CHARS, _chunks

client = TestClient(app)


def test_chunks_short_text_single():
    assert _chunks("hello") == ["hello"]
    assert _chunks("") == []


def test_chunks_respect_limit():
    # 긴 본문이 limit 이하 조각들로 분할되고, 합치면 원문과 동일
    text = ("line of some length\n" * 1000)
    parts = _chunks(text)
    assert len(parts) > 1
    assert all(len(p) <= MAX_CHARS for p in parts)
    assert "".join(parts) == text


def test_chunks_oversized_single_line():
    # 줄바꿈 없는 초장문도 강제 분할
    text = "x" * (MAX_CHARS * 2 + 7)
    parts = _chunks(text)
    assert all(len(p) <= MAX_CHARS for p in parts)
    assert "".join(parts) == text


def test_missing_keys_returns_503(monkeypatch):
    # Papago 키 미설정 시 503 (번역 미설정 안내)
    monkeypatch.setattr(settings, "papago_client_id", "", raising=False)
    monkeypatch.setattr(settings, "papago_client_secret", "", raising=False)
    monkeypatch.delenv("PAPAGO_CLIENT_ID", raising=False)
    monkeypatch.delenv("PAPAGO_CLIENT_SECRET", raising=False)
    r = client.post("/internal/translate", json={"title": "Engineer", "description": "About us"})
    assert r.status_code == 503


def test_description_too_long_is_422():
    r = client.post("/internal/translate", json={"description": "x" * 20_001})
    assert r.status_code == 422
