"""/internal/* 토큰 인증 — 설정 시 강제, 기본(빈 값)은 비활성, health 는 개방."""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.config import settings
from app.main import app

client = TestClient(app)

_PAYLOAD = {"jd": "python", "resume": "python developer"}


def test_auth_disabled_by_default(monkeypatch):
    # 기본(빈 토큰) → 헤더 없이도 통과(로컬/테스트는 네트워크 격리에 의존)
    monkeypatch.setattr(settings, "internal_auth_token", "")
    r = client.post("/internal/skill-match", json=_PAYLOAD)
    assert r.status_code == 200


def test_auth_enforced_when_token_set_missing_header(monkeypatch):
    monkeypatch.setattr(settings, "internal_auth_token", "secret-token")
    r = client.post("/internal/skill-match", json=_PAYLOAD)
    assert r.status_code == 401


def test_auth_enforced_wrong_token(monkeypatch):
    monkeypatch.setattr(settings, "internal_auth_token", "secret-token")
    r = client.post("/internal/skill-match", json=_PAYLOAD, headers={"X-Internal-Token": "nope"})
    assert r.status_code == 401


def test_auth_passes_with_correct_token(monkeypatch):
    monkeypatch.setattr(settings, "internal_auth_token", "secret-token")
    r = client.post("/internal/skill-match", json=_PAYLOAD, headers={"X-Internal-Token": "secret-token"})
    assert r.status_code == 200


def test_health_open_even_when_token_set(monkeypatch):
    # liveness 프로브용 — 토큰 설정돼도 health 는 인증 없이 접근 가능
    monkeypatch.setattr(settings, "internal_auth_token", "secret-token")
    r = client.get("/internal/health")
    assert r.status_code == 200
