#!/usr/bin/env python3
"""회사 소개 요약을 Wikipedia REST 요약 API 에서 정직하게 보강.

company-facts.ts 에 이미 검수된 Wikidata QID 를 **재사용**한다 — 새 이름 매칭이
없으므로 오매칭 위험 0. QID → sitelink(kowiki 우선, 없으면 enwiki) → REST 요약.

키는 company-facts.ts 의 키를 그대로 상속한다 — 즉 DB 회사 slug(=ATS token).
registry key(companies.json 의 키)와 다른 회사가 있으니 새 키를 만들 때 주의.

- 동음이의(disambiguation) 문서는 채택하지 않음(틀린 소개보다 미표시가 낫다).
- 요약은 첫 문단 플레인 텍스트를 문장 경계에서 최대 ~450자 로 자른다.
- 출처(CC BY-SA) 표기를 위해 문서 URL 을 함께 저장한다.

사용:
    python enrich_company_summaries.py \
        --facts ../../web/lib/company-facts.ts \
        --out   ../../web/lib/company-summaries.ts
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.parse
import urllib.request

UA = "DevPass/1.0 (company directory enrichment; hello@devpass.kr)"
API = "https://www.wikidata.org/w/api.php?"
SUMMARY = "https://{lang}.wikipedia.org/api/rest_v1/page/summary/{title}"
MAX_LEN = 450


def _get(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    last = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 404:  # 문서 없음 — 재시도 무의미
                raise
            last = e
            time.sleep(1.5 * (attempt + 1))
        except Exception as e:  # noqa: BLE001 - 네트워크 재시도
            last = e
            time.sleep(1.5 * (attempt + 1))
    raise last  # type: ignore[misc]


def parse_facts(path: str) -> dict[str, str]:
    """company-facts.ts 에서 slug → QID. (검수 완료된 매칭만 존재)"""
    out: dict[str, str] = {}
    pat = re.compile(r'^\s*"([^"]+)":\s*\{\s*wikidataId:\s*"(Q\d+)"')
    for line in open(path, encoding="utf-8"):
        m = pat.match(line)
        if m:
            out[m.group(1)] = m.group(2)
    return out


def sitelinks(qids: list[str]) -> dict[str, dict[str, str]]:
    """QID → {"ko": 제목, "en": 제목} (있는 것만). 50개씩 배치 조회."""
    out: dict[str, dict[str, str]] = {}
    uniq = list(dict.fromkeys(qids))
    for i in range(0, len(uniq), 50):
        q = urllib.parse.urlencode({
            "action": "wbgetentities", "ids": "|".join(uniq[i:i + 50]),
            "props": "sitelinks", "sitefilter": "kowiki|enwiki", "format": "json",
        })
        for qid, ent in _get(API + q).get("entities", {}).items():
            links = ent.get("sitelinks", {})
            rec = {}
            if "kowiki" in links:
                rec["ko"] = links["kowiki"]["title"]
            if "enwiki" in links:
                rec["en"] = links["enwiki"]["title"]
            if rec:
                out[qid] = rec
        time.sleep(0.2)
    return out


def _clip(text: str) -> str:
    """문장 경계에서 MAX_LEN 이내로 자름(중간 절단 방지)."""
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= MAX_LEN:
        return text
    cut = text[:MAX_LEN]
    # 마지막 문장 종결(영문 마침표 또는 한국어 '다.') 위치까지만.
    m = list(re.finditer(r"(?<=[.!?])\s|(?<=다\.)\s?", cut))
    return cut[:m[-1].end()].rstrip() if m else cut.rstrip() + "…"


def fetch_summary(lang: str, title: str):
    """REST 요약. (extract, url) 또는 None(동음이의·빈 요약)."""
    url = SUMMARY.format(lang=lang, title=urllib.parse.quote(title.replace(" ", "_"), safe="_()"))
    try:
        d = _get(url)
    except Exception as e:  # noqa: BLE001
        print(f"  ! summary fail {lang}:{title}: {e}", file=sys.stderr)
        return None
    if d.get("type") != "standard":  # disambiguation 등 채택 금지
        return None
    extract = (d.get("extract") or "").strip()
    if len(extract) < 40:  # 실질 내용 없는 스텁
        return None
    page = d.get("content_urls", {}).get("desktop", {}).get("page") \
        or f"https://{lang}.wikipedia.org/wiki/{urllib.parse.quote(title.replace(' ', '_'))}"
    return _clip(extract), page


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--facts", required=True, help="company-facts.ts 경로(QID 소스)")
    ap.add_argument("--out", required=True, help="출력 .ts 경로(company-summaries.ts)")
    args = ap.parse_args()

    slug_qid = parse_facts(args.facts)
    if not slug_qid:
        print("company-facts.ts 에서 QID 를 찾지 못함", file=sys.stderr)
        return 1
    links = sitelinks(list(slug_qid.values()))

    summaries: dict[str, dict] = {}
    for i, (slug, qid) in enumerate(sorted(slug_qid.items()), 1):
        rec = links.get(qid)
        if not rec:
            print(f"[{i}/{len(slug_qid)}] {slug:18} NO-SITELINK", file=sys.stderr)
            continue
        got = None
        for lang in ("ko", "en"):  # 한국어 문서 우선
            if lang not in rec:
                continue
            got = fetch_summary(lang, rec[lang])
            if got:
                summaries[slug] = {
                    "lang": lang, "title": rec[lang],
                    "extract": got[0], "url": got[1],
                }
                break
            time.sleep(0.05)
        print(f"[{i}/{len(slug_qid)}] {slug:18} "
              f"{summaries[slug]['lang'] if slug in summaries else 'NONE'}",
              file=sys.stderr)
        time.sleep(0.05)

    _write_ts(args.out, summaries)
    print(f"\n총 {len(slug_qid)}곳 중 {len(summaries)}곳 요약 → {args.out}", file=sys.stderr)
    return 0


def _write_ts(path: str, summaries: dict[str, dict]) -> None:
    """company-summaries.ts 생성. company-facts.ts 와 같은 'slug→객체' 패턴."""
    esc = lambda s: s.replace("\\", "\\\\").replace('"', '\\"')  # noqa: E731
    lines = [
        "// 회사 소개 요약 — Wikipedia REST 요약 API(CC BY-SA)에서 보강한 데이터.",
        "// scripts/enrich_company_summaries.py 로 생성하고, 사람이 git diff 로 검수한다.",
        "// company-facts.ts 의 검수된 QID·sitelink 만 재사용 — 새 이름 매칭 없음(오매칭 0).",
        "// CC BY-SA 라이선스: 표시 시 문서 링크(url)로 출처를 함께 노출할 것.",
        "",
        "export interface CompanySummary {",
        "  /** 위키 문서 언어(ko 우선, 없으면 en). */",
        '  lang: "ko" | "en";',
        "  /** 위키 문서 제목(검수용). */",
        "  title: string;",
        "  /** 요약 첫 문단(플레인 텍스트, 문장 경계 절단). */",
        "  extract: string;",
        "  /** 문서 URL(출처 표기용). */",
        "  url: string;",
        "}",
        "",
        "export const COMPANY_SUMMARIES: Record<string, CompanySummary> = {",
    ]
    for slug in sorted(summaries):
        s = summaries[slug]
        lines.append(
            f'  "{esc(slug)}": {{ lang: "{s["lang"]}", title: "{esc(s["title"])}", '
            f'extract: "{esc(s["extract"])}", url: "{esc(s["url"])}" }},'
        )
    lines.append("};")
    lines.append("")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


if __name__ == "__main__":
    sys.exit(main())
