#!/usr/bin/env python3
"""companies.json 에 domain·aliases(·hq) 를 Wikidata 에서 채워 넣는다(in-place, 멱등).

스폰서 명부 매칭(scripts/sponsor_match.py)의 정확도를 높이기 위한 데이터 보강:
- domain  : 공식 웹사이트(P856) 호스트. 회사 신원 키 + 검토 표시용.
- aliases : 공식 명칭(P1448)·짧은 이름(P1813)·en 별칭 — 명부의 '법인명'과 매칭하기 위한 이름 변형
            (브랜드만으론 못 잡는 'Wise ↔ Wise Payments Ltd' 같은 누락을 메운다).
- hq      : 본사 도시(P159, 비어있을 때만) — 동명 회사 위치 disambiguation 용.

enrich_companies_wikidata 의 보수적 매칭(오매칭 0 게이트)을 재사용한다. 기존 값은
덮어쓰지 않는다(--overwrite 제외). tags 배열 등 기존 포맷을 보존해 사람이 git diff 로 검수.

사용:
  python scripts/backfill_company_domains.py --dry-run         # 미리보기(쓰지 않음)
  python scripts/backfill_company_domains.py --only wise,wolt  # 일부만
  python scripts/backfill_company_domains.py --limit 20        # 앞 N곳만
  python scripts/backfill_company_domains.py                   # 전체 반영(in-place)
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

# Wikidata 매칭·추출 헬퍼 재사용(오매칭 0 게이트 동일).
from enrich_companies_wikidata import _first_value, _ids, labels, match
from sponsor_match import normalize

REGISTRY_PATH = Path(__file__).parent.parent / "dev_jobs_core" / "data" / "companies.json"

# domain 후보로 부적합한 호스트(있어도 회사 식별에 무의미). 보수적으로만.
_BAD_HOST = re.compile(r"^(www\.)?(facebook|twitter|x|linkedin|instagram|youtube)\.com$", re.I)

# 별칭 잡음: 도메인형(elastic.co)·티커심볼(DASH)·괄호/중복공백(Coinbase, Inc. (Oakland, CA)).
_ALIAS_DOMAIN = re.compile(r"^[a-z0-9.-]+\.[a-z]{2,}$", re.I)
_ALIAS_TICKER = re.compile(r"^[A-Z]{1,5}$")


def _is_noisy_alias(s: str) -> bool:
    """명부 매칭에 무의미하거나 잡음인 별칭인가(도메인·티커·괄호/중복공백)."""
    return bool(
        _ALIAS_DOMAIN.match(s) or _ALIAS_TICKER.match(s)
        or "(" in s or ")" in s or "  " in s
    )


def _host(url) -> str | None:
    """공식 웹사이트 URL → 호스트(소문자, 선행 www. 제거). 부적합하면 None."""
    if not isinstance(url, str) or not url.strip():
        return None
    netloc = urlparse(url.strip()).netloc or urlparse("//" + url.strip()).netloc
    host = netloc.lower().split(":")[0].lstrip(".")
    host = re.sub(r"^www\.", "", host)
    if not host or "." not in host or _BAD_HOST.match(host):
        return None
    return host


def _aliases(e: dict, key: str, token: str) -> list[str]:
    """명부 매칭용 이름 변형: 공식명(P1448)·짧은이름(P1813)·en 별칭.

    기존 브랜드(key)·token 과 정규화상 동일한 건 제외(중복 잡음 방지).
    """
    cand: list[str] = []
    for pid in ("P1448", "P1813"):
        v = _first_value(e, pid)
        if isinstance(v, dict) and v.get("text"):
            cand.append(v["text"].strip())
    for a in e.get("aliases", {}).get("en", []):
        val = (a or {}).get("value", "").strip()
        if val:
            cand.append(val)

    skip = {normalize(key), normalize(token)}
    out: list[str] = []
    seen: set[str] = set()
    for c in cand:
        n = normalize(c)
        if not n or n in skip or n in seen or _is_noisy_alias(c):
            continue
        seen.add(n)
        out.append(c)
    return out[:5]


def _collapse_arrays(text: str) -> str:
    """스칼라만 든 멀티라인 배열을 한 줄로 되접는다(중첩 객체·배열 제외)."""
    return re.sub(
        r"\[\n(?P<body>[^\[\]{}]*?)\n\s*\]",
        lambda m: "[" + " ".join(ln.strip() for ln in m.group("body").splitlines() if ln.strip()) + "]",
        text,
    )


def _block(slug: str, obj: dict) -> str:
    """회사 1곳을 '  "slug": { ... }' 블록 텍스트로 직렬화(indent 2, 스칼라 배열 한 줄)."""
    s = json.dumps({slug: obj}, indent=2, ensure_ascii=False)
    inner = "\n".join(s.splitlines()[1:-1])  # 바깥 '{' '}' 제거
    return _collapse_arrays(inner)


def _splice(text: str, slug: str, obj: dict) -> str:
    """원본 텍스트에서 slug 블록만 새 블록으로 교체(나머지는 바이트 보존).

    원본 companies.json 은 tags 배열이 한 줄/여러 줄 혼재라 전체 재직렬화는 무관한
    회사까지 reformat 한다. 변경된 회사만 외과적으로 갈아끼워 diff 를 최소화한다.
    """
    # '  "slug": {' 부터 같은 들여쓰기('  }')의 첫 닫힘까지(중첩 닫힘은 4칸이라 매칭 안 됨).
    pat = re.compile(r'^  ' + re.escape(json.dumps(slug)) + r': \{.*?\n  \}', re.S | re.M)
    new, n = pat.subn(lambda _m: _block(slug, obj), text, count=1)
    if n != 1:
        raise SystemExit(f"블록 교체 실패: {slug} (매칭 {n}건)")
    return new


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="변경 미리보기만(파일 미수정)")
    ap.add_argument("--overwrite", action="store_true", help="기존 domain/aliases/hq 도 덮어씀")
    ap.add_argument("--only", help="쉼표구분 slug 목록만 처리")
    ap.add_argument("--limit", type=int, default=None, help="앞 N곳만 처리")
    args = ap.parse_args()

    raw = REGISTRY_PATH.read_text(encoding="utf-8")
    data = json.loads(raw)
    only = {s.strip() for s in args.only.split(",")} if args.only else None

    slugs = [k for k in data if not k.startswith("_")]
    if only:
        slugs = [s for s in slugs if s in only]
    if args.limit:
        slugs = slugs[: args.limit]

    changed_slugs: list[str] = []
    none = 0
    text = raw  # 누적 텍스트(변경 회사만 splice). 체크포인트로 디스크에 주기 저장.

    def checkpoint():
        if not args.dry_run and changed_slugs:
            REGISTRY_PATH.write_text(text, encoding="utf-8")

    for i, slug in enumerate(slugs, 1):
        info = data[slug]
        # 재개 최적화: 이미 domain 이 있으면 네트워크 호출 없이 건너뜀(--overwrite 제외).
        if not args.overwrite and info.get("domain"):
            print(f"[{i}/{len(slugs)}] {slug:20} (이미 있음, skip)", file=sys.stderr)
            continue
        try:
            m = match(slug, slug.replace("-", " "))
            updates: dict[str, object] = {}
            if m:
                _qid, e = m
                dom = _host(_first_value(e, "P856"))
                if dom and (args.overwrite or not info.get("domain")):
                    updates["domain"] = dom
                al = _aliases(e, slug, info.get("token", ""))
                if al and (args.overwrite or not info.get("aliases")):
                    updates["aliases"] = al
                hq_ids = _ids(e, "P159")[:1]
                if hq_ids and (args.overwrite or not info.get("hq")):
                    hq = labels(hq_ids).get(hq_ids[0])
                    if hq:
                        updates["hq"] = hq
        except Exception as exc:  # noqa: BLE001 - 한 곳 실패가 전체를 죽이지 않게
            print(f"[{i}/{len(slugs)}] {slug:20} ! {type(exc).__name__}: {exc}", file=sys.stderr)
            time.sleep(1.0)
            continue

        if not m:
            none += 1
            print(f"[{i}/{len(slugs)}] {slug:20} NONE", file=sys.stderr)
        elif updates:
            info.update(updates)
            text = _splice(text, slug, info)
            changed_slugs.append(slug)
            if len(changed_slugs) % 10 == 0:
                checkpoint()  # 10건마다 디스크 저장 → 중간에 죽어도 진행분 보존·재개 가능.
            shown = ", ".join(f"{k}={v}" for k, v in updates.items())
            print(f"[{i}/{len(slugs)}] {slug:20} + {shown}", file=sys.stderr)
        else:
            print(f"[{i}/{len(slugs)}] {slug:20} (변경 없음)", file=sys.stderr)
        time.sleep(0.15)

    print(f"\n총 {len(slugs)}곳 중 {len(changed_slugs)}곳 보강, {none}곳 미매칭", file=sys.stderr)
    if args.dry_run:
        print("--dry-run: 파일을 쓰지 않음", file=sys.stderr)
    elif changed_slugs:
        checkpoint()
        print(f"→ {REGISTRY_PATH} 갱신 ({len(changed_slugs)}곳)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
