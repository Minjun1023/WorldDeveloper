from dev_jobs_core.analyzers.job_meta import extract_language, extract_relocation


# ── relocation ───────────────────────────────────────────────────────────────

def test_relo_offer_assistance():
    assert extract_relocation("We offer relocation assistance and visa sponsorship.") is True


def test_relo_offer_bonus():
    assert extract_relocation("Benefits include: Up to $15k Relocation bonus for new hires.") is True


def test_relo_offer_jp():
    assert extract_relocation("福利厚生: 引っ越し補助あり") is True


def test_relo_requirement_is_not_offer():
    assert extract_relocation("You must be willing to relocate to NYC.") is None
    assert extract_relocation("Available to relocate to San Francisco.") is None


def test_relo_explicit_no():
    assert extract_relocation("Please note: no relocation assistance is available for this role.") is False


def test_relo_unmentioned():
    assert extract_relocation("We build great software with Python and Go.") is None


# ── language ────────────────────────────────────────────────────────────────

def test_lang_fluent_german():
    assert extract_language("Requirements: fluent German and English.") == "german"


def test_lang_level_code():
    assert extract_language("You speak German (B2) or better.") == "german"


def test_lang_required_suffix():
    assert extract_language("Japanese is required for this customer-facing role.") == "japanese"


def test_lang_plus_not_required():
    assert extract_language("German is a plus, but not required.") is None


def test_lang_english_only():
    assert extract_language("Full professional proficiency in English.") == "english_only"
    assert extract_language("Our working language is English.") == "english_only"
    assert extract_language("No German language skills required — our team works in English.") == "english_only"


def test_lang_unmentioned():
    assert extract_language("We ship fast and iterate.") is None


# ── 실데이터에서 놓쳤던 패턴들 (2026-07-03 recall 보강) ──────────────────────

def test_relo_no_will_not_be_provided():
    assert extract_relocation("Please note: Relocation will not be provided for this role.") is False


def test_relo_no_with_words_between():
    assert extract_relocation(
        "We are currently not able to support visa applications or relocation for this position."
    ) is False


def test_lang_fluent_in_english_only():
    assert extract_language("Fluent in English (French is a plus but not required)") == "english_only"
    assert extract_language("Fluent written and spoken English") == "english_only"


def test_lang_proficiency_verbal_written_english():
    assert extract_language("Strong communication skills with proficiency in verbal and written English") == "english_only"


def test_lang_no_need_to_speak():
    assert extract_language("Fluent in English (no need to speak French)") == "english_only"


def test_lang_english_and_german_is_not_english_only():
    # 영어+독일어 둘 다 요구 — english_only 로 오인하면 안 됨.
    assert extract_language("You are fluent in English and German.") == "german"


def test_lang_fluent_in_german():
    assert extract_language("Fluent in German is required for this role.") == "german"
