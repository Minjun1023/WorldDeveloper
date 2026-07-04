import importlib.util
import json
import pathlib
import sys

_spec = importlib.util.spec_from_file_location(
    "backfill_company_domains",
    pathlib.Path(__file__).parent.parent / "scripts" / "backfill_company_domains.py",
)
# 스크립트 디렉터리를 경로에 추가(enrich/sponsor_match 로컬 import). 네트워크는 import 시 없음.
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "scripts"))
bcd = importlib.util.module_from_spec(_spec)
sys.modules["backfill_company_domains"] = bcd
_spec.loader.exec_module(bcd)


def test_host_strips_scheme_www_and_path():
    assert bcd._host("https://www.wise.com/about") == "wise.com"
    assert bcd._host("http://Wolt.com") == "wolt.com"
    assert bcd._host("stripe.com") == "stripe.com"


def test_host_rejects_socials_and_junk():
    assert bcd._host("https://www.linkedin.com/company/x") is None
    assert bcd._host("") is None
    assert bcd._host(None) is None
    assert bcd._host("notaurl") is None


def test_noisy_aliases_are_filtered():
    assert bcd._is_noisy_alias("elastic.co")          # 도메인형
    assert bcd._is_noisy_alias("www.twitch.tv")       # 도메인형
    assert bcd._is_noisy_alias("DASH")                # 티커
    assert bcd._is_noisy_alias("Coinbase, Inc. (Oakland, CA)")  # 괄호
    assert bcd._is_noisy_alias("Maplebear Inc.     (San Francisco, CA)")  # 중복공백
    assert not bcd._is_noisy_alias("Wise Payments Limited")
    assert not bcd._is_noisy_alias("Roofoods Ltd.")
    assert not bcd._is_noisy_alias("N26 Bank SE")


def test_aliases_excludes_noise():
    entity = {
        "claims": {"P1448": [{"mainsnak": {"datavalue": {"value": {"text": "Elasticsearch BV", "language": "en"}}}}]},
        "aliases": {"en": [{"value": "elastic.co"}, {"value": "Elastic NV"}]},
    }
    al = bcd._aliases(entity, "elastic", "elastic")
    assert "Elasticsearch BV" in al and "Elastic NV" in al
    assert "elastic.co" not in al


def test_aliases_from_official_and_alt_names_dedup_brand():
    entity = {
        "claims": {
            "P1448": [{"mainsnak": {"datavalue": {"value": {"text": "Wise Payments Limited", "language": "en"}}}}],
            "P1813": [{"mainsnak": {"datavalue": {"value": {"text": "Wise", "language": "en"}}}}],
        },
        "aliases": {"en": [{"value": "TransferWise"}, {"value": "wise"}]},
    }
    al = bcd._aliases(entity, "wise", "wise")
    # 공식명·다른 별칭은 포함, 브랜드/short name 'Wise'(정규화상 'wise')는 제외, 중복 제거.
    assert "Wise Payments Limited" in al
    assert "TransferWise" in al
    assert "Wise" not in al and "wise" not in al


def _registry_raw():
    p = pathlib.Path(__file__).parent.parent / "dev_jobs_core" / "data" / "companies.json"
    return p.read_text(encoding="utf-8")


def test_splice_changes_only_target_block():
    raw = _registry_raw()
    data = json.loads(raw)
    slug = "wolt"
    obj = dict(data[slug])
    obj["domain"] = "wolt.com"
    obj["aliases"] = ["Wolt Enterprises Oy"]
    out = bcd._splice(raw, slug, obj)
    d2 = json.loads(out)
    assert d2[slug]["domain"] == "wolt.com"
    assert d2[slug]["aliases"] == ["Wolt Enterprises Oy"]
    for k, v in data.items():
        if k != slug:
            assert d2[k] == v, f"무관한 회사가 변경됨: {k}"


def test_splice_last_company_without_trailing_comma():
    raw = _registry_raw()
    data = json.loads(raw)
    last = [k for k in data if not k.startswith("_")][-1]
    obj = dict(data[last])
    obj["domain"] = "example.com"
    out = bcd._splice(raw, last, obj)  # 매칭 실패 시 SystemExit
    assert json.loads(out)[last]["domain"] == "example.com"


def test_block_uses_inline_arrays():
    blk = bcd._block("acme", {"ats": "greenhouse", "token": "acme", "tags": ["a", "b"], "aliases": ["X Y Ltd"]})
    assert '"tags": ["a", "b"]' in blk
    assert '"aliases": ["X Y Ltd"]' in blk
    assert blk.startswith('  "acme": {')
