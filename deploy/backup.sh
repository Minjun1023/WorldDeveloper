#!/usr/bin/env bash
# Postgres 일일 백업 — pg_dump 전체 덤프를 gzip 으로 보관하고 오래된 파일을 정리한다.
#
# 설치(서버에서 1회):
#   crontab -e  →  30 4 * * * $HOME/WorldDeveloper/deploy/backup.sh >> $HOME/backups/backup.log 2>&1
#   (04:30 KST — 00:00 ETL 수집과 09:00 알림 배치 사이의 한가한 시간대)
#
# 수동 실행:
#   ~/WorldDeveloper/deploy/backup.sh
#
# 복원(비상시):
#   1) 스택 정지:   cd ~/WorldDeveloper/deploy && sudo docker compose -f docker-compose.prod.yml stop backend ai etl-worker web
#   2) 복원:       gunzip -c ~/backups/postgres/devjobs-<STAMP>.sql.gz | \
#                    sudo docker compose -f docker-compose.prod.yml exec -T postgres psql -U devjobs -d devjobs
#      (완전 초기화가 필요하면 먼저: exec -T postgres psql -U devjobs -d postgres -c "DROP DATABASE devjobs; CREATE DATABASE devjobs;")
#   3) 재기동:      sudo docker compose -f docker-compose.prod.yml up -d
#
# 한계: 백업이 같은 VM 디스크에 남는다 — 실수로 인한 삭제/잘못된 마이그레이션은 방어하지만
# 디스크 자체 장애는 방어하지 못한다. 오프호스트(OCI Object Storage) 업로드는 후속 작업.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/postgres}"
COMPOSE_FILE="${COMPOSE_FILE:-$HOME/WorldDeveloper/deploy/docker-compose.prod.yml}"
KEEP_DAYS="${KEEP_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$BACKUP_DIR/devjobs-$STAMP.sql.gz"

# --no-owner: 복원 시 소유자 매핑 문제 제거(단일 유저 devjobs 구성).
sudo docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U devjobs -d devjobs --no-owner | gzip > "$FILE"

# 무결성 확인 — 손상된 gzip 이면 여기서 실패해 cron 로그에 남는다.
gzip -t "$FILE"

echo "[$(date '+%F %T')] 백업 완료: $FILE ($(du -h "$FILE" | cut -f1))"

# 보존 정책: KEEP_DAYS 일 지난 백업 삭제.
find "$BACKUP_DIR" -name 'devjobs-*.sql.gz' -mtime "+$KEEP_DAYS" -delete
