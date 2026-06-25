"""synthesize_country_guide — 청크 그라운딩 합성(sync httpx 목)."""
import httpx
from app.config import settings
from app import visa_guides


def test_synthesize_grounds_on_chunks(monkeypatch):
    monkeypatch.setattr(settings, "openai_api_key", "test-key")
    captured = {}

    def fake_post(url, headers=None, json=None, timeout=None):
        captured["json"] = json

        class _R:
            status_code = 200
            text = ""

            def json(self):
                return {"choices": [{"message": {"content": "독일은 Blue Card 경로가 흔합니다."}}]}
        return _R()

    monkeypatch.setattr(visa_guides.httpx, "post", fake_post)
    chunks = [{"section": "visa_types", "content": "EU Blue Card 는 고숙련 취업비자."}]
    out = visa_guides.synthesize_country_guide("de", chunks)
    assert out == "독일은 Blue Card 경로가 흔합니다."
    user_msg = captured["json"]["messages"][-1]["content"]
    assert "EU Blue Card" in user_msg


def test_synthesize_no_key_returns_none(monkeypatch):
    monkeypatch.setattr(settings, "openai_api_key", "")
    assert visa_guides.synthesize_country_guide("de", [{"section": "x", "content": "y"}]) is None
