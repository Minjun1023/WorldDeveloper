from dev_jobs_core.sources import lever

# 실제 Lever Posting API 구조(spotify). description=도입부만, 본문은 lists,
# 마무리는 additional 에 분리. 일부 섹션은 <ul> 없이 맨 <li>(div 래퍼) 로 옴.
ITEM_REAL = {
    "text": "Accounts Payable Analyst",
    "description": "<div>You'll join the Finance team.</div>",
    "opening": "",
    "lists": [
        {"text": "What You'll Do",
         "content": "<div>\n\n<li data-start=\"1\">Support AP operations</li>\n<li>Reconcile</li></div>"},
        {"text": "Who You Are",
         "content": "<div>\n<ul data-start=\"2\"><li>You have experience</li></ul></div>"},
        {"text": "", "content": "   "},  # 빈 섹션은 건너뛴다
    ],
    "additional": "<div>The US base range is $66,189–$94,556.</div>",
}


def test_compose_includes_intro_sections_and_additional_in_order():
    out = lever._compose_description(ITEM_REAL)
    # 순서: 도입부 → 섹션들 → 마무리
    assert out.index("You'll join") < out.index("What You'll Do")
    assert out.index("What You'll Do") < out.index("Who You Are")
    assert out.index("Who You Are") < out.index("base range")
    # 섹션 제목은 <h3> 로 감싼다
    assert "<h3>What You'll Do</h3>" in out
    assert "<h3>Who You Are</h3>" in out


def test_compose_wraps_bare_li_but_not_existing_ul():
    out = lever._compose_description(ITEM_REAL)
    # 맨 <li> 섹션은 <ul> 로 감싸고, 이미 <ul> 인 섹션은 중복 래핑하지 않는다
    assert "<ul><div>\n\n<li" in out  # bare-li 섹션 래핑됨
    assert out.count("<ul") == 2  # 래핑 1 + 기존 1, 중복 래핑 없음


def test_compose_skips_empty_sections():
    out = lever._compose_description(ITEM_REAL)
    assert "<h3></h3>" not in out  # 제목 빈 섹션 미포함


def test_compose_intro_falls_back_to_opening():
    item = {"description": "", "opening": "<p>Intro from opening.</p>", "lists": []}
    assert lever._compose_description(item) == "<p>Intro from opening.</p>"


def test_compose_falls_back_to_plain_when_no_structured_fields():
    item = {"descriptionPlain": "Just plain text."}
    assert lever._compose_description(item) == "Just plain text."


def test_compose_empty_item_returns_empty():
    assert lever._compose_description({}) == ""
