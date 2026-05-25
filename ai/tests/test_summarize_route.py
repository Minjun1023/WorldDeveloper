import os

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app

client = TestClient(app)


def test_empty_description_returns_400():
    r = client.post("/internal/summarize", json={"title": "x", "description": "   "})
    assert r.status_code == 400


@pytest.mark.skipif(
    bool(settings.openai_api_key or os.getenv("OPENAI_API_KEY")),
    reason="OPENAI_API_KEY set — 503 경로 스킵",
)
def test_no_key_returns_503():
    r = client.post("/internal/summarize", json={"description": "We need a senior backend engineer."})
    assert r.status_code == 503
