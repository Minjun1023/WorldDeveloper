"""오프라인 측정: bi-encoder 순위 vs cross-encoder 재정렬 순위 비교.

semantic 축만 격리해 측정한다(visa/location/salary 등 다른 점수 제외).
pgvector로 bi-encoder 상위 N을 가져와 CrossEncoder로 재정렬하고,
before/after 상위 K개를 표로 출력 + 보조 통계.

실행: cd ai && uv run --extra embeddings python -m scripts.eval_reranker
      [--profile kr_backend|senior_frontend|ml_engineer|all] [--n 50] [--k 10] [--json]
"""
from __future__ import annotations


def rank_movement_avg(before_ids: list, after_ids: list) -> float:
    """after 상위 항목들이 before 대비 평균 몇 칸 이동했는지 (|Δ| 평균).

    before_ids 에 없는(새로 진입한) 항목은 분모에서 제외된다.
    """
    pos = {x: i for i, x in enumerate(before_ids)}
    moves = [abs(pos[x] - i) for i, x in enumerate(after_ids) if x in pos]
    return sum(moves) / len(moves) if moves else 0.0


def kendall_tau(order_a: list, order_b: list) -> float:
    """두 순위의 Kendall τ (1=동일, -1=완전역순). 공통 항목 기준."""
    b_set = set(order_b)
    common = [x for x in order_a if x in b_set]
    rank_b = {x: i for i, x in enumerate(order_b)}
    n = len(common)
    if n < 2:
        return 1.0
    conc = disc = 0
    for i in range(n):
        for j in range(i + 1, n):
            if rank_b[common[i]] < rank_b[common[j]]:
                conc += 1
            else:
                disc += 1
    total = conc + disc
    return (conc - disc) / total if total else 1.0


def topk_churn(before_ids: list, after_ids: list, k: int) -> int:
    """after 상위 k에 새로 진입한(before 상위 k엔 없던) 항목 수."""
    return len(set(after_ids[:k]) - set(before_ids[:k]))


# --- 측정 실행부 ---
# 아래 import와 PERSONAS는 모듈 로드 시 실행되지만 부수효과 없음:
# settings는 .env 읽기만, emb/rr는 lazy-load wrapper, PERSONAS는 순수 dataclass 생성.
# DB 연결·모델 로드는 main() 안에서만 발생.
import argparse  # noqa: E402

from app.config import settings  # noqa: E402
from dev_jobs_core.recommender import embeddings as emb  # noqa: E402
from dev_jobs_core.recommender import reranker as rr  # noqa: E402
from dev_jobs_core.recommender.profile import UserProfile  # noqa: E402

PERSONAS: dict[str, UserProfile] = {
    "kr_backend": UserProfile(
        skills=["go", "python", "postgres", "kafka"],
        seniority="mid",
        years_experience=3,
        needs_visa_sponsorship=True,
        preferred_locations=["Remote", "Singapore", "Tokyo"],
        remote_preference="any",
        bio="결제 도메인 백엔드 개발자. 고가용 결제 API와 정산 파이프라인 설계.",
        resume_text=(
            "Go와 Python으로 대용량 트래픽 결제 시스템을 3년간 개발. "
            "Kafka 기반 이벤트 처리, PostgreSQL 정산 데이터 모델링 경험."
        ),
    ),
    "senior_frontend": UserProfile(
        skills=["typescript", "react", "next.js", "css"],
        seniority="senior",
        years_experience=7,
        remote_preference="remote_only",
        bio="시니어 프론트엔드 엔지니어. 디자인 시스템과 접근성에 강함.",
        resume_text=(
            "React/TypeScript로 대규모 웹앱 7년. Next.js SSR, 컴포넌트 라이브러리, "
            "웹 성능 최적화와 접근성(a11y) 경험."
        ),
    ),
    "ml_engineer": UserProfile(
        skills=["python", "pytorch", "transformers", "sql"],
        seniority="mid",
        years_experience=4,
        remote_preference="any",
        bio="ML·데이터 엔지니어. 추천/검색 모델과 데이터 파이프라인.",
        resume_text=(
            "PyTorch로 임베딩/추천 모델을 학습·서빙. Transformer 기반 의미검색, "
            "대규모 데이터 파이프라인과 피처 엔지니어링 경험."
        ),
    ),
}


def _job_doc(title: str, description_text: str) -> str:
    return f"{title or ''} {description_text or ''}".strip()


def _profile_text(p: UserProfile) -> str:
    return " ".join(filter(None, [p.bio, p.resume_text]))


def _fetch_bi_topn(conn, vec: list[float], n: int) -> list[dict]:
    """pgvector 거리순 상위 N. 각 행에 bi cosine 유사도(1-dist) 포함."""
    rows = conn.execute(
        """
        SELECT id, company_slug, title, description_text,
               (embedding <=> %(vec)s) AS dist
        FROM jobs
        WHERE is_active AND embedding IS NOT NULL
        ORDER BY dist
        LIMIT %(n)s
        """,
        {"vec": vec, "n": n},
    ).fetchall()
    out = []
    for jid, slug, title, dtext, dist in rows:
        out.append(
            {
                "id": jid,
                "company": slug,
                "title": title,
                "doc": _job_doc(title, dtext),
                "bi_sim": 1.0 - float(dist),
            }
        )
    return out


def _evaluate(conn, persona_key: str, p: UserProfile, n: int, k: int) -> dict | None:
    ptext = _profile_text(p)
    vec = emb.embed_text(ptext)
    if vec is None:
        print(f"[{persona_key}] 임베딩 비활성 — 건너뜀")
        return None
    cands = _fetch_bi_topn(conn, vec, n)
    if not cands:
        print(f"[{persona_key}] 후보 0건 — 건너뜀")
        return None

    before_ids = [c["id"] for c in cands]
    scores = rr.rerank(ptext, [c["doc"] for c in cands])
    if not scores:
        print(f"[{persona_key}] 리랭커 점수 없음 — 건너뜀")
        return None

    order = sorted(range(len(cands)), key=lambda i: scores[i], reverse=True)
    after = [{**cands[i], "rerank": float(scores[i])} for i in order]
    after_ids = [c["id"] for c in after]

    return {
        "persona": persona_key,
        "n": n,
        "k": k,
        "before": cands,
        "after": after,
        "before_ids": before_ids,
        "after_ids": after_ids,
        "stats": {
            "rank_movement_avg": round(rank_movement_avg(before_ids, after_ids[:k]), 2),
            "topk_churn": topk_churn(before_ids, after_ids, k),
            "kendall_tau": round(kendall_tau(before_ids, after_ids), 3),
        },
    }


def _print_report(r: dict) -> None:
    before_pos = {c["id"]: i for i, c in enumerate(r["before"])}
    print(f"\n### 프로필: {r['persona']}  (N={r['n']}, top-{r['k']})\n")
    print(f"{'rank':>4}  {'bi→rr':>7}  {'Δ':>4}  {'company':<16}  {'title':<40}  {'bi':>5}  {'rr':>6}")  # noqa: E501
    for new_rank, c in enumerate(r["after"][: r["k"]]):
        old = before_pos[c["id"]]
        delta = old - new_rank
        arrow = f"▲{delta}" if delta > 0 else (f"▼{-delta}" if delta < 0 else "·")
        print(
            f"{new_rank + 1:>4}  {old + 1:>3}→{new_rank + 1:<3}  {arrow:>4}  "
            f"{(c['company'] or '')[:16]:<16}  {(c['title'] or '')[:40]:<40}  "
            f"{c['bi_sim']:>5.2f}  {c['rerank']:>6.2f}"
        )
    s = r["stats"]
    print(
        f"\n보조 통계: top-{r['k']} 평균 순위이동 {s['rank_movement_avg']} | "
        f"진입/이탈 {s['topk_churn']}개 | Kendall τ {s['kendall_tau']}"
    )


def main() -> None:
    import json

    import psycopg
    from pgvector.psycopg import register_vector

    ap = argparse.ArgumentParser(description="cross-encoder 리랭커 오프라인 측정")
    ap.add_argument("--profile", default="all", help="kr_backend|senior_frontend|ml_engineer|all")
    ap.add_argument("--n", type=int, default=50, help="bi-encoder 검색 깊이")
    ap.add_argument("--k", type=int, default=10, help="비교 출력 상위 개수")
    ap.add_argument("--model", default=None, help="cross-encoder 모델 override")
    ap.add_argument("--json", action="store_true", help="JSON 출력")
    args = ap.parse_args()

    if args.model:
        rr.MODEL_NAME = args.model

    if not rr.is_available():
        raise SystemExit(
            "리랭커 모델 미가용 — 'uv sync --extra embeddings' 후 다시 실행하세요."
        )
    if not emb.is_available():
        raise SystemExit("임베딩 모델 미가용 — 'uv sync --extra embeddings' 필요.")

    if args.profile != "all" and args.profile not in PERSONAS:
        raise SystemExit(f"알 수 없는 프로필: {args.profile} (가능: {', '.join(PERSONAS)})")
    keys = list(PERSONAS) if args.profile == "all" else [args.profile]

    conn = psycopg.connect(settings.database_url)
    register_vector(conn)

    results = []
    for key in keys:
        r = _evaluate(conn, key, PERSONAS[key], args.n, args.k)
        if r is None:
            continue
        results.append(r)
        if not args.json:
            _print_report(r)

    conn.close()

    if args.json:
        slim = [
            {"persona": r["persona"], "stats": r["stats"],
             "after_top": [{"company": c["company"], "title": c["title"],
                            "bi_sim": round(c["bi_sim"], 3), "rerank": round(c["rerank"], 3)}
                           for c in r["after"][: r["k"]]]}
            for r in results
        ]
        print(json.dumps(slim, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
