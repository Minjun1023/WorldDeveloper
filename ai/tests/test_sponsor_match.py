import importlib.util
import pathlib
import sys

# scripts/sponsor_match.py 를 모듈로 로드(패키지 경로 밖이라 직접 로드).
_spec = importlib.util.spec_from_file_location(
    "sponsor_match",
    pathlib.Path(__file__).parent.parent / "scripts" / "sponsor_match.py",
)
sm = importlib.util.module_from_spec(_spec)
sys.modules["sponsor_match"] = sm  # dataclass 가 __future__ annotations 해석 시 참조.
_spec.loader.exec_module(sm)


def test_company_names_includes_token_and_aliases():
    names = sm.company_names("wise", {"token": "wise", "aliases": ["Wise Payments Ltd"]})
    assert names == {"wise", "Wise Payments Ltd"}


def test_aliases_match_legal_name_brand_alone_misses():
    """브랜드만으론 못 잡는 법인명을 공식 별칭으로 매칭한다."""
    register = [("Wise Payments Limited", "London")]
    # 브랜드 'wise' 단독: org 첫 토큰이 'wise payments...' → 첫 토큰 'wise'==brand 라 매칭됨.
    # 하지만 접두가 다른 법인명은 별칭 없이는 누락된다.
    register2 = [("TransferWise Group Ltd", "London")]
    assert sm.find_candidates({"wise"}, None, register2) == []
    names = sm.company_names("wise", {"token": "wise", "aliases": ["TransferWise"]})
    cands = sm.find_candidates(names, None, register2)
    assert len(cands) == 1 and cands[0].org == "TransferWise Group Ltd"
    # 정상 케이스(별칭 불필요)도 여전히 동작
    assert sm.find_candidates({"wise"}, None, register)[0].org == "Wise Payments Limited"


def test_single_match_never_rejected_by_location_conflict():
    """다국적 함정: 단독 매칭은 위치가 달라도 reject 하지 않고 medium 으로 남긴다."""
    # 회사 hq=New York, 명부(UK 현지 법인)=London → 위치 conflict 지만 후보 유지.
    register = [("Datadog Ltd", "London")]
    cands = sm.find_candidates({"datadog"}, "New York", register)
    assert len(cands) == 1
    assert cands[0].confidence == "medium"
    assert cands[0].location == "conflict"


def test_single_match_location_agree_is_high():
    register = [("Wise Payments Ltd", "London")]
    cands = sm.find_candidates({"wise"}, "London", register)
    assert cands[0].confidence == "high"
    assert cands[0].location == "agree"


def test_ambiguous_same_name_disambiguated_by_location():
    """동명 회사가 여럿이면 위치 일치하는 것만 high, 나머지는 low(사람 검토)."""
    register = [
        ("Box Ltd", "Manchester"),
        ("Box Ltd", "London"),
    ]
    cands = sm.find_candidates({"box"}, "London", register)
    assert cands[0].confidence == "high" and cands[0].loc == "London"
    assert cands[1].confidence == "low" and cands[1].loc == "Manchester"


def test_no_name_match_returns_empty():
    assert sm.find_candidates({"acme"}, "London", [("Globex Ltd", "London")]) == []


def test_location_signal_unknown_when_missing():
    assert sm.location_signal(None, "London") == "unknown"
    assert sm.location_signal("London", "") == "unknown"
    assert sm.location_signal("London, UK", "London") == "agree"
