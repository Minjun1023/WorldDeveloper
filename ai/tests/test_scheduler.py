"""ETL 스케줄 트리거 단위 테스트 — 매일 고정 시각(cron)인지 검증."""
from apscheduler.triggers.cron import CronTrigger

from app.config import settings
from app.etl import scheduler


def _fields(trigger: CronTrigger) -> dict[str, str]:
    return {f.name: str(f) for f in trigger.fields}


def test_default_is_daily_midnight():
    t = scheduler.build_etl_trigger()
    assert isinstance(t, CronTrigger)
    f = _fields(t)
    # 매일 00:00: 분=0, 시=0, 일/월/요일=매일(*)
    assert f["minute"] == "0"
    assert f["hour"] == "0"
    assert f["day"] == "*"
    assert f["day_of_week"] == "*"


def test_respects_custom_cron(monkeypatch):
    # ETL_CRON='30 6 * * 1-5' (평일 06:30) 처럼 변경 가능해야 함
    monkeypatch.setattr(settings, "etl_cron", "30 6 * * 1-5")
    t = scheduler.build_etl_trigger()
    f = _fields(t)
    assert f["minute"] == "30"
    assert f["hour"] == "6"
    assert f["day_of_week"] == "mon-fri" or "1-5" in f["day_of_week"]


def test_uses_configured_timezone():
    t = scheduler.build_etl_trigger()
    # 기본 Asia/Seoul — 컨테이너 TZ 와 무관하게 해당 TZ 자정에 실행.
    assert "Seoul" in str(t.timezone)
