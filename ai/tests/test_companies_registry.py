import json
from pathlib import Path

from app.etl.jobs import ATS_FETCHERS

REGISTRY_PATH = Path(__file__).parent.parent / "dev_jobs_core" / "data" / "companies.json"


def _load():
    with open(REGISTRY_PATH) as f:
        return json.load(f)


def test_companies_json_is_valid_json():
    data = _load()
    assert isinstance(data, dict)
    assert "_meta" in data


def test_every_company_has_known_ats_and_token():
    data = _load()
    known = set(ATS_FETCHERS.keys())
    for name, info in data.items():
        if name.startswith("_"):
            continue
        assert info.get("ats") in known, f"{name}: unknown ats {info.get('ats')!r}"
        assert info.get("token"), f"{name}: empty token"


def test_no_duplicate_tokens_per_ats():
    data = _load()
    seen = set()
    for name, info in data.items():
        if name.startswith("_"):
            continue
        key = (info["ats"], info["token"].lower())
        assert key not in seen, f"duplicate {key} ({name})"
        seen.add(key)


def test_uk_sponsor_flag_is_bool_when_present():
    data = _load()
    for name, info in data.items():
        if name.startswith("_"):
            continue
        if "uk_sponsor" in info:
            assert isinstance(info["uk_sponsor"], bool), f"{name}: uk_sponsor not bool"


def test_h1b_sponsor_flag_is_bool_when_present():
    data = _load()
    for name, info in data.items():
        if name.startswith("_"):
            continue
        if "h1b_sponsor" in info:
            assert isinstance(info["h1b_sponsor"], bool), f"{name}: h1b_sponsor not bool"


def test_domain_and_aliases_shapes_when_present():
    """명부 매칭용 선택 필드(domain·aliases) 형식 검증(있을 때만)."""
    data = _load()
    for name, info in data.items():
        if name.startswith("_"):
            continue
        if "domain" in info:
            d = info["domain"]
            assert isinstance(d, str) and d and "/" not in d, f"{name}: domain은 호스트 문자열이어야 함"
        if "aliases" in info:
            a = info["aliases"]
            assert isinstance(a, list) and all(isinstance(x, str) and x for x in a), (
                f"{name}: aliases는 비어있지 않은 문자열 목록이어야 함"
            )
