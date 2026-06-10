#!/usr/bin/env python3
"""ATS 회사 발굴 probe-verify: 후보 토큰을 각 ATS 엔드포인트에 실제로 찔러
유효 보드 + 개발 공고 수를 확인한다(추측 배제). registry 에 이미 있는 토큰은 건너뛴다.

각 토큰에 대해 greenhouse/lever/ashby/smartrecruiters/workable 를 모두 시도하고,
공고가 잡히는 ATS 와 (전체/개발) 건수, 샘플 회사명·제목을 출력한다. 사람이 검토 후
companies.json 에 반영한다.

실행: cd ai && uv run python scripts/probe_ats.py /path/to/tokens.txt
  tokens.txt: 한 줄에 하나(토큰). 빈 줄/`#` 주석 무시.
"""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

from dev_jobs_core.filter import is_dev_role
from dev_jobs_core.sources import ashby, greenhouse, lever, smartrecruiters, workable

ATS = {
    "greenhouse": greenhouse.fetch,
    "lever": lever.fetch,
    "ashby": ashby.fetch,
    "smartrecruiters": smartrecruiters.fetch,
    "workable": workable.fetch,
}
REG = Path(__file__).parent.parent / "dev_jobs_core" / "data" / "companies.json"
_PROBE_LIMIT = 80
_SEM = asyncio.Semaphore(10)


async def _try(ats: str, fn, token: str):
    async with _SEM:
        try:
            jobs = await fn(token, limit=_PROBE_LIMIT)
        except Exception:
            return None
    if not jobs:
        return None
    dev = [j for j in jobs if is_dev_role(j.title, getattr(j, "tags", None) or [])]
    sample = jobs[0]
    company = getattr(sample, "company", "") or ""
    return {
        "ats": ats,
        "total": len(jobs),
        "dev": len(dev),
        "company": company,
        "sample_title": sample.title,
    }


async def probe_token(token: str) -> dict | None:
    # 모든 ATS 동시 시도 → 잡히는 것 중 dev 가장 많은 것
    results = await asyncio.gather(*[_try(a, fn, token) for a, fn in ATS.items()])
    hits = [r for r in results if r]
    if not hits:
        return None
    best = max(hits, key=lambda r: r["dev"])
    best["token"] = token
    best["other_ats"] = [r["ats"] for r in hits if r["ats"] != best["ats"]]
    return best


async def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("사용: uv run python scripts/probe_ats.py tokens.txt")
    reg = json.load(open(REG, encoding="utf-8"))
    known = {v.get("token", "").lower() for k, v in reg.items() if isinstance(v, dict)}

    tokens = []
    for line in Path(sys.argv[1]).read_text(encoding="utf-8").splitlines():
        t = line.strip().lower()
        if not t or t.startswith("#"):
            continue
        if t in known:
            continue
        tokens.append(t)
    tokens = list(dict.fromkeys(tokens))  # dedupe, 순서유지

    results = await asyncio.gather(*[probe_token(t) for t in tokens])
    confirmed = [r for r in results if r and r["dev"] > 0]
    confirmed.sort(key=lambda r: -r["dev"])

    print(f"\n후보 {len(tokens)} → 유효보드+개발공고 확인 {len(confirmed)}곳\n")
    print(f"{'token':22} {'ats':15} {'dev':>4} {'tot':>4}  회사명 / 샘플제목")
    for r in confirmed:
        other = f" (+{','.join(r['other_ats'])})" if r["other_ats"] else ""
        print(f"{r['token']:22} {r['ats']:15} {r['dev']:>4} {r['total']:>4}  "
              f"{(r['company'] or '?')[:24]} | {r['sample_title'][:40]}{other}")

    out = Path("/tmp/probe_confirmed.json")
    out.write_text(json.dumps(confirmed, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n확인 결과 저장: {out}")


if __name__ == "__main__":
    asyncio.run(main())
