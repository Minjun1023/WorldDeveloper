from dev_jobs_core.analyzers.remote_geo import classify_remote_eligibility as cls


def test_not_remote_returns_none():
    assert cls("New York, US", False, "")[0] is None


def test_worldwide_location():
    assert cls("Remote - Worldwide", True, "")[0] == "worldwide"


def test_work_from_anywhere_in_description():
    assert cls("Remote", True, "You can work from anywhere.")[0] == "worldwide"


def test_apac_region():
    assert cls("Remote - APAC", True, "")[0] == "apac_ok"


def test_korea_location():
    assert cls("Seoul, South Korea", True, "")[0] == "apac_ok"


def test_us_location_restricted():
    assert cls("Remote (US)", True, "")[0] == "region_restricted"


def test_europe_location_restricted():
    assert cls("Remote, Europe", True, "")[0] == "region_restricted"


def test_japan_single_country_restricted():
    # 특정 다른 APAC 국가 단독은 한국 제외 → restricted
    assert cls("Tokyo, Japan", True, "")[0] == "region_restricted"


def test_strong_phrase_beats_worldwide():
    # 명시적 lock-out 은 worldwide 신호가 있어도 이긴다 (헛된 희망 방지)
    assert cls("Remote - Worldwide", True, "You must be based in the US.")[0] == "region_restricted"


def test_timezone_overlap_restricted():
    assert cls("Remote", True, "Requires overlap with US timezone.")[0] == "region_restricted"


def test_bare_remote_unclear():
    # 권역 명시 없는 원격은 worldwide 로 추정하지 않고 정직하게 unclear
    assert cls("Remote", True, "Great team, Python and Go.")[0] == "unclear"


def test_empty_location_unclear():
    assert cls("", True, "")[0] == "unclear"


def test_evidence_returned():
    status, ev = cls("Remote (US)", True, "")
    assert status == "region_restricted"
    assert len(ev) >= 1


# --- 라이브 2368건 검증으로 드러난 회귀 케이스 (location 권위 / 본문 노이즈 차단) ---


def test_restrictive_location_beats_description_worldwide():
    # location 이 US 한정이면 본문의 "worldwide leader" 마케팅 문구에 속지 않는다
    assert cls("Remote - US", True, "We are a worldwide leader in payments.")[0] == "region_restricted"


def test_country_location_beats_description_apac():
    # location 이 Canada 면 본문의 "support our APAC clients" 에 속지 않는다
    assert cls("Remote (Canada)", True, "You will support our APAC clients.")[0] == "region_restricted"


def test_specific_country_location_restricted():
    # restrict 목록에 없는 나라여도 location 에 지명이 있으면 한정 (한국 미포함)
    assert cls("Argentina Remote", True, "")[0] == "region_restricted"
    assert cls("Remote - India", True, "")[0] == "region_restricted"


def test_bare_worldwide_in_description_not_trusted():
    # 본문의 맨 단어 "worldwide" 는 신호로 쓰지 않는다 → unclear
    assert cls("", True, "A worldwide leader in fintech.")[0] == "unclear"


def test_global_location_worldwide():
    assert cls("Remote - Global", True, "")[0] == "worldwide"


# --- Playwright ground-truth 검증으로 드러난 정밀도 보강 (역할별 지리 요구 > 회사 보일러플레이트) ---


def test_apac_timezone_requirement_beats_boilerplate():
    # 실제 Supabase 공고: 회사는 "work from anywhere"라지만 역할은 APAC 타임존 한정 → apac_ok (한국 포함)
    desc = (
        "We hire globally. We believe you can do your best work from anywhere. "
        "This role requires a location within APAC time zones."
    )
    assert cls("Remote", True, desc)[0] == "apac_ok"


def test_apac_timezone_phrase_apac_ok():
    assert cls("Remote", True, "You will work within APAC time zones.")[0] == "apac_ok"


def test_us_location_requirement_beats_boilerplate():
    desc = "Work from anywhere! This role requires a location within the US."
    assert cls("Remote", True, desc)[0] == "region_restricted"


def test_us_timezone_plural_requirement_restricted():
    assert cls("Remote", True, "You must be available during US time zones.")[0] == "region_restricted"


def test_apac_duty_phrase_is_not_a_requirement():
    # "support our APAC clients"는 업무 문구(요구 프레이밍 없음) → apac_ok 로 오인하지 않는다
    assert cls("Remote", True, "You will support our APAC clients daily.")[0] == "unclear"


# --- 제목의 거시 권역 태그 (location 이 bare-remote 일 때 본문 보일러플레이트보다 우선) ---


def test_title_amer_tag_beats_worldwide_boilerplate():
    # 실제 케이스: 제목 "(AMER)" 인데 본문 "work from anywhere" 보일러플레이트로 worldwide 오분류되던 버그
    assert (
        cls(
            "Remote",
            True,
            "We let you work from anywhere.",
            title="Customer Solution Architect Team Lead (AMER)",
        )[0]
        == "region_restricted"
    )


def test_title_apac_tag_is_apac_ok():
    assert cls("Remote", True, "", title="Account Executive (APAC)")[0] == "apac_ok"


def test_title_emea_tag_restricted():
    assert (
        cls("Remote", True, "work from anywhere", title="Sales Engineer - EMEA")[0]
        == "region_restricted"
    )


def test_title_us_paren_restricted():
    assert cls("Remote", True, "", title="Support Engineer (US)")[0] == "region_restricted"


def test_title_no_region_tag_keeps_worldwide():
    # 권역 태그 없는 제목은 본문 worldwide 구문을 그대로 신뢰
    assert (
        cls("Remote", True, "work from anywhere", title="Software Engineer (Go) - Auth")[0]
        == "worldwide"
    )


def test_title_lowercase_us_word_not_restricted():
    # 소문자 'us' 대명사는 지역 태그가 아니다 → 오탐으로 region_restricted 되면 안 됨
    assert (
        cls("Remote", True, "work from anywhere", title="Come join us remotely")[0]
        == "worldwide"
    )


def test_specific_location_overrides_title_tag():
    # location 권위가 제목 태그보다 우선 (worldwide 명시면 제목 (AMER) 무시)
    assert cls("Remote - Worldwide", True, "", title="Engineer (AMER)")[0] == "worldwide"


def test_title_tag_ignored_when_not_remote():
    assert cls("New York, US", False, "", title="Engineer (APAC)")[0] is None
