import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
import verify_uk_sponsors as v


def test_normalize_strips_legal_and_geo_suffixes_only():
    # 법인/지역 접미사만 제거. 업종어(bank/payments)는 유지(회사 구분에 필요).
    assert v.normalize("Monzo Bank Ltd") == "monzo bank"
    assert v.normalize("GoCardless Limited") == "gocardless"
    assert v.normalize("Stripe Payments UK Ltd") == "stripe payments"


def test_match_exact():
    assert v.match_company("gocardless", "GoCardless Limited") is True


def test_match_prefix_proposes_candidate():
    assert v.match_company("monzo", "Monzo Bank Ltd") is True
    assert v.match_company("stripe", "Stripe Payments UK Ltd") is True
    # 동음이의어도 후보로는 잡힌다 — 거부는 사람 몫(코드 아님).
    assert v.match_company("asana", "Asana Healthcare Ltd") is True


def test_match_rejects_unrelated():
    assert v.match_company("monzo", "Bossmans Retail Abergavenny Ltd") is False
    assert v.match_company("gocardless", "Boltwhiz Limited") is False


def test_short_name_requires_exact():
    # 4자 미만 브랜드는 접두 허용 안 함(정확 일치만).
    assert v.match_company("n8n", "n8n GmbH") is True
    assert v.match_company("n8n", "n8n Solutions Ltd") is False
