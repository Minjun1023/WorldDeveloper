"""오프라인 측정: bi-encoder 순위 vs cross-encoder 재정렬 순위 비교.

semantic 축만 격리해 측정한다(visa/location/salary 등 다른 점수 제외).
pgvector로 bi-encoder 상위 N을 가져와 CrossEncoder로 재정렬하고,
before/after 상위 K개를 표로 출력 + 보조 통계.

실행: cd ai && uv run --extra embeddings python -m scripts.eval_reranker
      [--profile kr_backend|senior_frontend|ml_engineer|all] [--n 50] [--k 10] [--json]
"""
from __future__ import annotations


def rank_movement_avg(before_ids: list, after_ids: list) -> float:
    """after 상위 항목들이 before 대비 평균 몇 칸 이동했는지 (|Δ| 평균)."""
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
