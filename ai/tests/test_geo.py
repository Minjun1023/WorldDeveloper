from dev_jobs_core.geo import detect_city, detect_country


def test_curated_cities_and_countries():
    assert detect_country("Petah Tikva, , Israel") == "il"
    assert detect_country("Bengaluru, India") == "in"
    assert detect_country("SG - Singapore") == "sg"
    assert detect_country("Bangkok, Thailand") == "th"
    assert detect_country("Taipei, Taiwan") == "tw"
    assert detect_country("Menlo Park, CA") == "us"
    assert detect_country("東京都 港区") == "jp"


def test_pycountry_fallback_covers_long_tail():
    # 규칙에 없는 나라도 국가명 세그먼트로 해석
    assert detect_country("Sofia, Bulgaria") == "bg"
    assert detect_country("Nairobi, Kenya") == "ke"
    assert detect_country("Buenos Aires, Argentina") == "ar"


def test_aliases():
    assert detect_country("Remote - USA") == "us"
    assert detect_country("Remote, UK") == "gb"


def test_precedence_us_city_beats_country_name_segment():
    # 'Atlanta, Georgia' → 규칙(atlanta=us)이 먼저라 미국(주), 조지아국(ge) 아님
    assert detect_country("Atlanta, Georgia") == "us"


def test_unknown_returns_none():
    assert detect_country("") is None
    assert detect_country(None) is None
    assert detect_country("Remote") is None
    assert detect_country("N/A") is None


def test_detect_city_extracts_and_merges_variants():
    assert detect_city("Bengaluru, India") == "bengaluru"
    assert detect_city("Bangalore, India") == "bengaluru"       # 별칭 병합
    assert detect_city("SG - Singapore") == "singapore"          # 국가접두 제거
    assert detect_city("Petah Tikva, , Israel") == "petah-tikva"
    assert detect_city("São Paulo") == detect_city("Sao Paulo") == "sao-paulo"  # 액센트 정규화
    assert detect_city("東京都 港区") == "tokyo"                    # CJK
    assert detect_city("AU - Melbourne") == "melbourne"
    assert detect_city("Bangkok (Central World Office)") == "bangkok"  # 괄호/office 제거


def test_detect_city_none_for_country_only_and_remote():
    assert detect_city("India") is None          # 국가명만 → 도시 아님
    assert detect_city("Remote - US") is None     # 국가코드 잔재
    assert detect_city("Remote") is None
    assert detect_city("N/A") is None
    assert detect_city("") is None
    assert detect_city(None) is None
