#!/usr/bin/env python3
"""회사별 대표 위치/국가를 DB(active 공고)에서 집계해 web/lib/company-locations.ts 생성.

회사 디렉터리 카드에서, 수기 큐레이션(company-profiles.ts)이 없는 회사도
위치/국기를 보여주기 위한 폴백 데이터다. 백엔드/DB 스키마 변경 없이,
공고의 freeform location 문자열에서 대표 위치를 고르고 국가(ISO2)를 추론한다.

실행:
  docker exec dev-jobs-postgres psql -U devjobs -d devjobs -F $'\\t' -A -t \\
    -c "$(cat ai/scripts/company_locations.sql)" | python3 ai/scripts/gen_company_locations.py

또는 편의 래퍼: ai/scripts/gen_company_locations.sh
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / "web" / "lib" / "company-locations.ts"

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
    ("pt", ["portugal", "lisbon", "lisboa", "porto"]),
    ("it", ["italy", "milan", "milano", "rome", "roma", "turin", "torino"]),
    ("ch", ["switzerland", "zurich", "zürich", "geneva", "genève", "lausanne",
            "basel", "bern", "-ch", "schweiz"]),
    ("at", ["austria", "vienna", "wien", "graz", "linz"]),
    ("be", ["belgium", "brussels", "bruxelles", "antwerp", "ghent"]),
    ("pl", ["poland", "warsaw", "warszawa", "kraków", "krakow", "wrocław",
            "wroclaw", "gdańsk", "gdansk", "poznań", "poznan"]),
    ("cz", ["czech", "prague", "praha", "brno"]),
    ("ro", ["romania", "bucharest", "cluj"]),
    ("ie2", []),  # placeholder (없음)
    ("ca", ["canada", "toronto", "vancouver", "montreal", "montréal", "ottawa",
            "waterloo", "calgary", "edmonton"]),
    ("au", ["australia", "sydney", "melbourne", "brisbane", "perth", "canberra"]),
    ("nz", ["new zealand", "auckland", "wellington"]),
    ("th", ["thailand", "bangkok"]),
    ("in", ["india", "bengaluru", "bangalore", "mumbai", "delhi", "hyderabad",
            "pune", "chennai", "gurgaon", "gurugram", "noida"]),
    ("hk", ["hong kong"]),
    ("ae", ["united arab", "dubai", "abu dhabi", "uae"]),
    ("br", ["brazil", "brasil", "são paulo", "sao paulo", "rio de janeiro"]),
    ("mx", ["mexico", "méxico", "mexico city", "guadalajara"]),
    ("ee", ["estonia", "tallinn", "tartu"]),
    ("lt", ["lithuania", "vilnius"]),
    ("lv", ["latvia", "riga"]),
    ("ua", ["ukraine", "kyiv", "kiev", "lviv"]),
    ("il", ["israel", "tel aviv", "jerusalem", "herzliya"]),
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
_RULES = [(iso, pats) for iso, pats in _RULES if pats]

_BARE_REMOTE = {"remote", "anywhere", "worldwide", "remote - anywhere", "global"}


def detect_country(loc: str) -> str | None:
    s = loc.lower()
    for iso, pats in _RULES:
        for p in pats:
            if p in s:
                return iso
    return None


def clean_location(loc: str) -> str:
    """반복 콤마 구간 제거 등 가벼운 정리. 'Berlin, Berlin, Germany'→'Berlin, Germany'."""
    loc = re.sub(r"\s+", " ", loc).strip()
    parts = [p.strip() for p in loc.split(",") if p.strip()]
    out: list[str] = []
    for p in parts:
        if not out or out[-1].lower() != p.lower():
            out.append(p)
    return ", ".join(out) if out else loc


def main() -> None:
    rows: dict[str, dict[str, str]] = {}
    for line in sys.stdin:
        line = line.rstrip("\n")
        if not line or "\t" not in line:
            continue
        slug, location = line.split("\t", 1)
        slug = slug.strip()
        raw = location.strip()
        if not slug or not raw:
            continue
        is_bare_remote = raw.lower() in _BARE_REMOTE
        label = "원격" if is_bare_remote else clean_location(raw)
        country = None if is_bare_remote else detect_country(raw)
        entry: dict[str, str] = {"location": label}
        if country:
            entry["country"] = country
        rows[slug] = entry

    # 결정적 출력(slug 정렬)
    lines = [
        "// AUTO-GENERATED by ai/scripts/gen_company_locations.py — 직접 편집 금지.",
        "// 회사별 대표 위치/국가(ISO2). 수기 큐레이션(company-profiles.ts)이 없는 회사의",
        "// 카드 위치/국기 폴백용. active 공고의 location 문자열에서 집계·추론한 스냅샷이다.",
        "// 재생성: docker exec dev-jobs-postgres psql ... | python3 ai/scripts/gen_company_locations.py",
        "",
        "export interface DerivedLocation {",
        "  location: string;",
        "  /** ISO 3166-1 alpha-2 소문자. 추론 실패 시 없음. */",
        "  country?: string;",
        "}",
        "",
        "export const COMPANY_LOCATIONS: Record<string, DerivedLocation> = {",
    ]
    for slug in sorted(rows):
        e = rows[slug]
        loc = e["location"].replace("\\", "\\\\").replace('"', '\\"')
        key = slug.replace("\\", "\\\\").replace('"', '\\"')
        if "country" in e:
            lines.append(f'  "{key}": {{ location: "{loc}", country: "{e["country"]}" }},')
        else:
            lines.append(f'  "{key}": {{ location: "{loc}" }},')
    lines.append("};")
    lines.append("")

    OUT.write_text("\n".join(lines), encoding="utf-8")
    n_country = sum(1 for e in rows.values() if "country" in e)
    print(f"wrote {OUT} — {len(rows)} companies, {n_country} with country", file=sys.stderr)


if __name__ == "__main__":
    main()
