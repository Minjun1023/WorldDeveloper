"""ETL 수동 트리거 (개발용)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..etl.jobs import run_full_cycle_stub

router = APIRouter()


@router.post("/etl/trigger")
async def trigger_etl() -> dict:
    """수동으로 ETL 한 사이클 실행 (MVP skeleton 에서는 stub)."""
    try:
        result = await run_full_cycle_stub()
        return {"status": "ok", "result": result}
    except Exception as e:
        raise HTTPException(500, f"ETL failed: {e}") from e
