"""ATS 소스(greenhouse/lever/ashby)가 company 토큰을 URL 인코딩하는지 — 경로 탈출/주입 방지."""
import asyncio

import httpx
import pytest

from dev_jobs_core.sources import ashby, greenhouse, lever


@pytest.mark.parametrize("mod", [greenhouse, lever, ashby])
def test_company_token_is_url_encoded(monkeypatch, mod):
    seen = {}

    async def fake_get(self, url, *args, **kwargs):
        seen["url"] = url
        raise RuntimeError("stop-after-capture")  # URL 캡처 후 네트워크 진행 중단

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)
    try:
        asyncio.run(mod.fetch("weird/../co"))
    except Exception:
        pass  # fetch 가 삼키든 전파하든, 우리는 캡처된 URL 만 본다

    url = seen.get("url", "")
    assert url, f"{mod.__name__}.fetch 가 get 을 호출하지 않음"
    assert "%2F" in url                 # 슬래시가 인코딩됨(경로 탈출 차단)
    assert "/weird/../co" not in url     # 원문 경로가 그대로 들어가지 않음
