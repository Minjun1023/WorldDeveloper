"""한국인 취업 가능성(viability) 게이트.

한국인이 실제로 취할 수 있는 공고:
    visa_status == 'sponsors'  (이주 가능)
    OR remote_eligibility in ('worldwide', 'apac_ok')  (한국서 원격 가능)

ETL 적재 단계에서는 그 반대 극단, 즉 '확정적으로 막힌' 공고만 드롭한다.
unclear(판정 불가)는 절대 드롭하지 않는다 — 기본 숨김 처리는 조회 계층의 몫.
"""
from __future__ import annotations


def is_dead_end(
    visa_status: str | None, is_remote: bool, remote_eligibility: str | None
) -> bool:
    """확정적으로 한국인에게 길이 막힌 공고면 True (적재 드롭 대상).

    비자가 명시적으로 거부(no_sponsor)이고, 동시에 원격으로도 한국이 막혔을 때만.
    """
    if visa_status != "no_sponsor":
        return False
    return (not is_remote) or remote_eligibility == "region_restricted"
