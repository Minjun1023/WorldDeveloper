#!/usr/bin/env python3
"""회사 사실(직원 규모·업종·설립연도·본사)을 Wikidata 에서 정직하게 보강.

프로젝트 원칙(추정 금지·정확도 우선)에 따라 **오매칭 0** 을 최우선으로 한다.
- 후보 라벨이 회사명/slug 와 일치(정규화 후) AND 인스턴스가 회사/비즈니스 AND
  보강 사실(직원/업종/설립) 또는 공식 웹사이트가 있을 때만 채택.
- 위 게이트를 통과 못하면 채택하지 않음(틀린 데이터보다 미표시가 낫다).
- 매칭된 QID 를 함께 저장해 사람이 git diff 로 검수/교정할 수 있게 한다.

데이터 출처: Wikidata (CC0). SPARQL 엔드포인트(query.wikidata.org)는 간헐적 강한
레이트리밋이 있어, 안정적인 REST(`Special:EntityData/{QID}.json`, CDN 캐시)로 claim 을
직접 파싱하고 라벨만 wbgetentities 로 배치 조회한다.

사용:
    python enrich_companies_wikidata.py --input slug_name.tsv --out company-facts.ts
입력 TSV: 각 줄 `slug<TAB or |>display_name`.
slug 는 **DB 회사 slug(=ATS token)** 를 쓸 것 — companies.json 의 registry key 와
다른 회사가 있다(예: abnormal→abnormalsecurity). 프론트는 company.slug 로 조회한다.
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
ENTITYDATA = "https://www.wikidata.org/wiki/Special:EntityData/{}.json"


def _get(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    last = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001 - 네트워크 재시도
            last = e
            time.sleep(1.5 * (attempt + 1))
    raise last  # type: ignore[misc]


def search(name: str, limit: int = 7) -> list[tuple[str, str, str]]:
    q = urllib.parse.urlencode({
        "action": "wbsearchentities", "search": name, "language": "en",
        "type": "item", "format": "json", "limit": limit,
    })
    return [(x["id"], x.get("label", ""), x.get("description", ""))
            for x in _get(API + q).get("search", [])]


def entity(qid: str) -> dict:
    return _get(ENTITYDATA.format(qid))["entities"][qid]


def _claims(e: dict, pid: str) -> list:
    return e.get("claims", {}).get(pid, [])


def _first_value(e: dict, pid: str):
    for c in _claims(e, pid):
        dv = c.get("mainsnak", {}).get("datavalue", {})
        if dv:
            return dv.get("value")
    return None


def _ids(e: dict, pid: str) -> list[str]:
    out = []
    for c in _claims(e, pid):
        v = c.get("mainsnak", {}).get("datavalue", {}).get("value")
        if isinstance(v, dict) and "id" in v:
            out.append(v["id"])
    return out


def _employees(e: dict):
    """가장 최근 시점(P585)의 직원 수(P1128). (count, year) 또는 None."""
    best = None
    for c in _claims(e, "P1128"):
        dv = c.get("mainsnak", {}).get("datavalue", {}).get("value")
        if not dv:
            continue
        amount = int(float(dv.get("amount", "0")))
        year = None
        for q in c.get("qualifiers", {}).get("P585", []):
            t = q.get("datavalue", {}).get("value", {}).get("time", "")
            if t:
                year = t[1:5]
        if best is None or (year or "0") > (best[1] or "0"):
            best = (amount, year)
    return best


def labels(qids: list[str]) -> dict[str, str]:
    out: dict[str, str] = {}
    uniq = [q for q in dict.fromkeys(qids) if q]
    for i in range(0, len(uniq), 50):
        q = urllib.parse.urlencode({
            "action": "wbgetentities", "ids": "|".join(uniq[i:i + 50]),
            "props": "labels", "languages": "en", "format": "json",
        })
        for k, v in _get(API + q).get("entities", {}).items():
            out[k] = v.get("labels", {}).get("en", {}).get("value", "")
        time.sleep(0.2)
    return out


_SUFFIX = re.compile(
    r"\b(inc|incorporated|ltd|limited|llc|gmbh|oy|oyj|ab|plc|corp|corporation"
    r"|technologies|technology|labs|sa|nv|co)\b\.?$", re.I)


def _norm(s: str) -> str:
    s = _SUFFIX.sub("", (s or "").strip())
    return re.sub(r"[^a-z0-9]", "", s.lower())


_COMPANY_WORDS = (
    "company", "business", "enterprise", "corporation", "brand", "manufacturer",
    "startup", "subsidiary", "online platform", "retailer", "bank", "marketplace",
    "payment processor", "financial services",
)


def _is_company(inst_labels: list[str], desc: str) -> bool:
    blob = (" ".join(inst_labels) + " " + desc).lower()
    return any(w in blob for w in _COMPANY_WORDS)


# 사람 검수에서 걸러낸 동명 오매칭(QID). 이름은 같지만 다른 실체라 채택 금지.
# (예: figma=일본 피규어 브랜드, gusto=일본 레스토랑, synthesia=체코 화학사 등)
_REJECT_QIDS = {
    "Q307650",    # figma — 일본 액션피규어 브랜드(Max Factory)
    "Q87724117",  # gusto — 일본 패밀리레스토랑(Skylark)
    "Q1097348",   # intercom — 헝가리 회사
    "Q11777443",  # mercor — 폴란드 화재방재사
    "Q12057983",  # synthesia — 체코 화학회사
}


def match(slug: str, name: str):
    """회사 1곳을 Wikidata 에 매칭. 채택 시 (qid, entity) 아니면 None."""
    try:
        cands = search(name)
    except Exception as e:  # noqa: BLE001
        print(f"  ! search fail {slug}: {e}", file=sys.stderr)
        return None
    fetched = []
    label_ids: list[str] = []
    for qid, lbl, desc in cands:
        try:
            e = entity(qid)
        except Exception:  # noqa: BLE001
            continue
        time.sleep(0.1)
        inst = _ids(e, "P31")
        fetched.append((qid, lbl, desc, inst, e))
        label_ids += inst
    inst_lab = labels(label_ids) if label_ids else {}

    name_n, slug_n = _norm(name), _norm(slug)
    for qid, lbl, desc, inst, e in fetched:
        if qid in _REJECT_QIDS:
            continue
        instl = [inst_lab.get(q, "") for q in inst]
        name_ok = _norm(lbl) in (name_n, slug_n)
        if not (name_ok and _is_company(instl, desc)):
            continue
        emp = _employees(e)
        industry = _ids(e, "P452")
        founded = _first_value(e, "P571")
        website = _first_value(e, "P856")
        if emp or industry or founded or website:
            return qid, e
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True, help="slug|name 또는 slug<TAB>name TSV")
    ap.add_argument("--out", required=True, help="출력 .ts 경로(company-facts.ts)")
    args = ap.parse_args()

    pairs = []
    for line in open(args.input, encoding="utf-8"):
        line = line.strip()
        if not line:
            continue
        slug, _, name = line.partition("|") if "|" in line else line.partition("\t")
        pairs.append((slug.strip(), name.strip()))

    facts: dict[str, dict] = {}
    need_labels: list[str] = []
    pending: dict[str, dict] = {}
    for i, (slug, name) in enumerate(pairs, 1):
        m = match(slug, name)
        if not m:
            print(f"[{i}/{len(pairs)}] {slug:18} NONE", file=sys.stderr)
            time.sleep(0.15)
            continue
        qid, e = m
        emp = _employees(e)
        rec = {
            "wikidataId": qid,
            "employees": emp[0] if emp else None,
            "employeesYear": emp[1] if emp else None,
            "industryIds": _ids(e, "P452")[:1],          # 1차 업종만(부가 라벨 잡음 회피)
            "founded": (_first_value(e, "P571") or {}).get("time", "")[1:5] or None,
            "hqIds": _ids(e, "P159")[:1],
            "countryIds": _ids(e, "P17")[:1],
            "website": _first_value(e, "P856"),
        }
        pending[slug] = rec
        need_labels += rec["industryIds"] + rec["hqIds"] + rec["countryIds"]
        print(f"[{i}/{len(pairs)}] {slug:18} {qid}", file=sys.stderr)
        time.sleep(0.15)

    lab = labels(need_labels)
    for slug, rec in pending.items():
        facts[slug] = {
            "wikidataId": rec["wikidataId"],
            "employees": rec["employees"],
            "employeesYear": rec["employeesYear"],
            "industry": lab.get(rec["industryIds"][0]) if rec["industryIds"] else None,
            "founded": rec["founded"],
            "hq": lab.get(rec["hqIds"][0]) if rec["hqIds"] else None,
            "country": lab.get(rec["countryIds"][0]) if rec["countryIds"] else None,
            "website": rec["website"],
        }

    _write_ts(args.out, facts)
    print(f"\n총 {len(pairs)}곳 중 {len(facts)}곳 매칭 → {args.out}", file=sys.stderr)
    return 0


def _write_ts(path: str, facts: dict[str, dict]) -> None:
    """company-facts.ts 생성. company-profiles.ts 와 같은 'slug→객체' 패턴."""
    lines = [
        "// 회사 사실(직원 규모·업종·설립연도·본사) — Wikidata(CC0) 에서 보강한 데이터.",
        "// scripts/enrich_companies_wikidata.py 로 생성하고, 정직성을 위해 사람이 git diff 로 검수한다.",
        "// (추정 금지: 신뢰 매칭만 채택. 없는 회사는 사실 패널을 표시하지 않는다.)",
        "",
        "export interface CompanyFacts {",
        "  /** Wikidata QID(출처 링크·검수용). */",
        "  wikidataId: string;",
        "  /** 직원 수(특정 시점 추정치). */",
        "  employees?: number | null;",
        "  /** 직원 수 기준 연도. */",
        "  employeesYear?: string | null;",
        "  /** 업종(영문 라벨, 표시 시 한국어 매핑). */",
        "  industry?: string | null;",
        "  /** 설립 연도. */",
        "  founded?: string | null;",
        "  /** 본사 도시. */",
        "  hq?: string | null;",
        "  /** 본사 국가. */",
        "  country?: string | null;",
        "  /** 공식 웹사이트. */",
        "  website?: string | null;",
        "}",
        "",
        "export const COMPANY_FACTS: Record<string, CompanyFacts> = {",
    ]
    for slug in sorted(facts):
        f = facts[slug]
        parts = [f'wikidataId: {json.dumps(f["wikidataId"])}']
        for key in ("employees", "employeesYear", "industry", "founded", "hq", "country", "website"):
            v = f.get(key)
            if v not in (None, ""):
                parts.append(f"{key}: {json.dumps(v, ensure_ascii=False)}")
        lines.append(f"  {json.dumps(slug)}: {{ {', '.join(parts)} }},")
    lines.append("};")
    lines.append("")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))


if __name__ == "__main__":
    raise SystemExit(main())
