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
