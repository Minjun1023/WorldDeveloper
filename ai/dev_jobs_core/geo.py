"""공고 location(자유텍스트) → 국가 ISO2 추론(공용).

지역 필터/집계를 하드코딩 국가목록이 아니라 데이터에서 파생하기 위한 해석기.
- 1순위: 큐레이션 규칙(_RULES) — 도시·별칭·CJK·US 주(州) 약어 등 국가명이 없는 위치와
  모호 케이스(예: 미국 도시)를 우선 판정. 순서가 곧 우선순위.
- 2순위: pycountry 국가명 매칭 — 규칙에 없는 나라(불가리아 등)를 콤마 세그먼트 단위로 커버.
불명확하면 None.

detect_country 는 ETL(ingest)·backfill·회사위치 스크립트가 공유한다.
"""
from __future__ import annotations

import re
import unicodedata

import pycountry

# 순서 중요: 국가명/명확한 도시를 먼저, 모호한 2글자 주(州) 약어는 마지막(US).
# 각 항목 (iso2, [소문자 부분문자열...]) — location 소문자에 부분일치하면 그 국가로 판정.
_RULES: list[tuple[str, list[str]]] = [
    ("jp", ["japan", "tokyo", "osaka", "kyoto", "yokohama", "nagoya", "fukuoka",
            "日本", "東京", "大阪"]),
    ("sg", ["singapore", "sg -"]),
    ("ie", ["ireland", "dublin"]),
    ("gb", ["united kingdom", " uk", "uk ", "(uk", ", uk", "u.k", "england",
            "scotland", "wales", "london", "manchester", "edinburgh", "bristol",
            "cambridge", "oxford", "leeds", "glasgow"]),
    ("nl", ["netherlands", "amsterdam", "rotterdam", "utrecht", "eindhoven",
            "the hague", "holland"]),
    ("de", ["germany", "deutschland", "berlin", "munich", "münchen", "muenchen",
            "hamburg", "frankfurt", "cologne", "köln", "koeln", "stuttgart",
            "düsseldorf", "dusseldorf", "leipzig", "dortmund", "essen", "bremen",
            "hannover", "nuremberg", "nürnberg", "karlsruhe", "mannheim",
            "magdeburg", "erfurt", "cottbus", "dresden", "bonn", "freiburg"]),
    ("fr", ["france", "paris", "lyon", "toulouse", "marseille", "lille", "nantes",
            "bordeaux"]),
    ("se", ["sweden", "stockholm", "gothenburg", "göteborg", "malmö", "malmo"]),
    ("dk", ["denmark", "copenhagen", "københavn", "aarhus"]),
    ("no", ["norway", "oslo", "bergen"]),
    ("fi", ["finland", "helsinki", "espoo", "tampere"]),
    ("es", ["spain", "madrid", "barcelona", "valencia", "málaga", "malaga",
            "seville"]),
    ("pt", ["portugal", "lisbon", "lisboa", "porto", "aveiro", "braga", "coimbra"]),
    ("it", ["italy", "milan", "milano", "rome", "roma", "turin", "torino"]),
    ("ch", ["switzerland", "zurich", "zürich", "geneva", "genève", "lausanne",
            "basel", "bern", "-ch", "schweiz"]),
    ("at", ["austria", "vienna", "wien", "graz", "linz"]),
    ("be", ["belgium", "brussels", "bruxelles", "antwerp", "ghent"]),
    ("pl", ["poland", "warsaw", "warszawa", "kraków", "krakow", "wrocław",
            "wroclaw", "gdańsk", "gdansk", "poznań", "poznan"]),
    ("cz", ["czech", "prague", "praha", "brno"]),
    ("ro", ["romania", "bucharest", "cluj"]),
    ("rs", ["serbia", "belgrade", "novi sad", "niš"]),
    ("ca", ["canada", "toronto", "vancouver", "montreal", "montréal", "ottawa",
            "waterloo", "calgary", "edmonton"]),
    ("au", ["australia", "sydney", "melbourne", "brisbane", "perth", "canberra"]),
    ("nz", ["new zealand", "auckland", "wellington"]),
    ("th", ["thailand", "bangkok"]),
    ("in", ["india", "bengaluru", "bangalore", "mumbai", "delhi", "hyderabad",
            "pune", "chennai", "gurgaon", "gurugram", "noida"]),
    ("hk", ["hong kong"]),
    ("tw", ["taiwan", "taipei", "kaohsiung", "tainan", "taichung", "hsinchu",
            "臺灣", "台灣", "台北", "臺北"]),
    ("ae", ["united arab", "dubai", "abu dhabi", "uae"]),
    ("br", ["brazil", "brasil", "são paulo", "sao paulo", "rio de janeiro"]),
    ("mx", ["mexico", "méxico", "mexico city", "guadalajara"]),
    ("ee", ["estonia", "tallinn", "tartu"]),
    ("lt", ["lithuania", "vilnius"]),
    ("lv", ["latvia", "riga"]),
    ("ua", ["ukraine", "kyiv", "kiev", "lviv"]),
    ("il", ["israel", "tel aviv", "jerusalem", "herzliya", "petah tikva"]),
    ("za", ["south africa", "cape town", "johannesburg"]),
    ("ph", ["philippines", "manila", "cebu"]),
    ("id", ["indonesia", "jakarta"]),
    ("my", ["malaysia", "kuala lumpur"]),
    ("vn", ["vietnam", "hanoi", "ho chi minh"]),
    ("kr", ["korea", "seoul"]),
    ("cn", ["china", "beijing", "shanghai", "shenzhen"]),
    # 미국: 국가명/대도시 → 마지막에 주(州) 약어 패턴.
    ("us", ["united states", "u.s.", "usa", "san francisco", "new york",
            "menlo park", "palo alto", "mountain view", "bay area", "seattle",
            "austin", "boston", "chicago", "los angeles", "washington",
            "foster city", "sunnyvale", "san jose", "santa clara", "denver",
            "atlanta", "san diego", "portland", "miami", "dallas", "houston",
            "remote - us", "remote us", "remote, us", ", us", "us -", "(us)",
            "us)", "redwood", "cupertino", "bellevue",
            ", ca", ", ny", ", wa", ", tx", ", ma", ", il", ", co", ", ga",
            ", fl", ", or", ", va", ", pa", ", nc", ", oh", ", az"]),
]


def _build_name_index() -> dict[str, str]:
    """pycountry 국가명/공식명/통용명(소문자) → iso2(소문자). 규칙에 없는 나라 폴백용."""
    idx: dict[str, str] = {}
    for c in pycountry.countries:
        iso = c.alpha_2.lower()
        for attr in ("name", "official_name", "common_name"):
            val = getattr(c, attr, None)
            if val:
                idx[val.lower()] = iso
    # 흔한 별칭(pycountry 정식명과 다른 표기)
    idx.update({"usa": "us", "u.s.": "us", "united states of america": "us",
                "uk": "gb", "u.k.": "gb", "south korea": "kr", "russia": "ru"})
    return idx


_NAME_INDEX = _build_name_index()
_SPLIT = re.compile(r"[,;/|]")


def _match_country_name(loc: str) -> str | None:
    """콤마/세미콜론 세그먼트가 국가명과 정확히 일치하면 그 국가(오탐 최소화 위해 전체일치)."""
    for seg in _SPLIT.split(loc):
        seg = seg.strip().lower()
        if seg in _NAME_INDEX:
            return _NAME_INDEX[seg]
    return None


def detect_country(loc: str | None) -> str | None:
    """location 문자열 → 국가 ISO2(소문자). 불명확하면 None."""
    if not loc:
        return None
    s = loc.lower()
    for iso, pats in _RULES:
        for p in pats:
            if p in s:
                return iso
    return _match_country_name(loc)


# --- 도시 추출(데이터 파생 도시 필터/집계용) ---------------------------------

# 근무형태만 있는 generic 값(도시 아님).
_GENERIC_CITY = {
    "remote", "hybrid", "onsite", "on-site", "on site", "anywhere", "worldwide",
    "global", "flexible", "fully remote", "remote first", "in office", "in-office",
    "office", "n/a", "various", "multiple locations", "hq",
}

# 도시 표기 변형 → 정규 도시명(중복 병합). 데이터에서 관찰된 것만 보수적으로.
_CITY_ALIAS = {
    "bangalore": "bengaluru", "gurgaon": "gurugram",
    "tel aviv-yafo": "tel aviv", "tel aviv office": "tel aviv",
    "sao paulo": "são paulo", "munchen": "münchen", "koln": "köln",
    "washington dc": "washington", "washington, d.c.": "washington",
    "new york city": "new york", "nyc": "new york",
    "bengaluru south": "bengaluru", "greater london": "london",
    "taipei city": "taipei", "hsinchu city": "hsinchu",
}

# CJK/현지표기 → 정규 도시명(부분일치). 순서 무관.
_CJK_CITY = [
    ("東京", "tokyo"), ("大阪", "osaka"), ("京都", "kyoto"), ("横浜", "yokohama"),
    ("名古屋", "nagoya"), ("福岡", "fukuoka"), ("台北", "taipei"), ("臺北", "taipei"),
    ("北京", "beijing"), ("上海", "shanghai"), ("深圳", "shenzhen"),
]

# 도시국가 등 '도시 == 국가' 인 경우(국가명 세그먼트여도 도시로 인정).
_CITY_STATES = {"singapore", "hong kong", "monaco", "luxembourg", "dubai", "abu dhabi"}


def _slugify_city(name: str) -> str:
    # 액센트 제거(São Paulo → sao-paulo, Zürich → zurich)
    ascii_ = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_.lower()).strip("-")


def detect_city(loc: str | None) -> str | None:
    """location → 정규 도시 slug(예: 'san-francisco', 'bengaluru'). 도시 불명확하면 None.

    첫 세그먼트를 도시 후보로: 'XX - ' 국가접두/괄호/Office 등 제거 → 별칭 병합 → slug.
    국가명만 있는 세그먼트(예: 'India')는 도시가 아니므로 None(도시국가는 예외).
    """
    if not loc:
        return None
    seg = re.split(r"[;,/|]", loc)[0]
    seg = re.sub(r"^\s*[A-Za-z]{2,3}\s*-\s*", "", seg)   # 'SG - ', 'AU - ' 접두 제거
    seg = re.sub(r"\(.*?\)", "", seg)                     # 괄호 주석 제거
    seg = re.sub(r"\b(office|hq|headquarters|remote|hybrid|onsite|metropolitan area)\b",
                 "", seg, flags=re.I)
    s = re.sub(r"\s+", " ", seg).strip().lower()
    # 선행·후행 기호 제거('- united states', 'brazil -' 등 → 국가명 매칭 가능하게)
    s = re.sub(r"^[\s\-–—.,/|:;()]+|[\s\-–—.,/|:;()]+$", "", s).strip()
    if not s or s in _GENERIC_CITY:
        return None
    for tok, slug in _CJK_CITY:
        if tok in loc:
            return slug
    s = _CITY_ALIAS.get(s, s)
    # 국가명만 있는 세그먼트는 도시 아님(도시국가는 통과).
    if s not in _CITY_STATES and _match_country_name(s):
        return None
    slug = _slugify_city(s)
    # 1글자 잡음(n/a→n)·2글자 국가코드 잔재(Remote - US→us)는 도시 아님.
    if len(slug) < 3:
        return None
    return slug
