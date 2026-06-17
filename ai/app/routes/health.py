from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter

from ..config import settings

router = APIRouter()


@router.get("/health")
async def health() -> dict:
    return {
        "service": settings.service_name,
        "status": "ok",
        "timestamp": datetime.now(UTC).isoformat(),
        "etl_enabled": settings.etl_enabled,
    }
