#!/usr/bin/env bash
#
# dev.sh — WorldDeveloper 로컬 개발 환경 한 번에 띄우기
#
#   ./dev.sh            DB + Mailhog + AI + 백엔드 + 프론트 모두 실행
#   ./dev.sh --stop     실행 중인 앱 프로세스 + DB 컨테이너 정리
#
# 순서: Postgres(5433) + Mailhog(1025/8025) → AI(8001) → 백엔드(8080) → 프론트(3000)
# 기본 포트를 쓰면 web→backend, backend→ai 연결이 환경변수 없이 맞물립니다.
# OAuth 키/시크릿은 루트 .env 에 두면 자동 로드됩니다 (.env.example 참고, .gitignore 처리됨).
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$ROOT/.dev-logs"
DB_CONTAINER="dev-jobs-postgres"

# --- .env 로드 (있으면) — OAuth 키, 공유 시크릿, 메일 설정 등 ---
if [ -f "$ROOT/.env" ]; then
  set -a; . "$ROOT/.env"; set +a
fi

# --- 포트/시크릿 (env 또는 .env 로 덮어쓰기 가능) ---
AI_PORT="${AI_PORT:-8001}"
BACKEND_PORT="${BACKEND_PORT:-8080}"
WEB_PORT="${WEB_PORT:-3000}"
JWT_SECRET="${JWT_SECRET:-dev-local-jwt-secret-change-me-min-32-bytes!!}"

# 인증 공유값 (web↔backend 동일해야 함) + URL
INTERNAL_AUTH_SECRET="${INTERNAL_AUTH_SECRET:-dev-internal-secret-change-me}"
APP_BASE_URL="${APP_BASE_URL:-http://localhost:$WEB_PORT}"
BACKEND_PUBLIC_URL="${BACKEND_PUBLIC_URL:-http://localhost:$BACKEND_PORT}"

# 메일 (로컬 Mailhog). 미설정이면 백엔드가 인증 링크를 backend.log 로 출력.
MAIL_HOST="${MAIL_HOST:-localhost}"
MAIL_PORT="${MAIL_PORT:-1025}"

# OAuth 키 (없으면 해당 공급자 버튼만 동작 안 함 — 빌드/기동엔 영향 없음)
GITHUB_CLIENT_ID="${GITHUB_CLIENT_ID:-}"
GITHUB_CLIENT_SECRET="${GITHUB_CLIENT_SECRET:-}"
GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-}"
GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-}"

PIDS=()

log()  { printf '\033[1;36m[dev]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[dev]\033[0m %s\n' "$*"; }

# --- 정리 ---
cleanup() {
  echo
  log "앱 프로세스 종료 중..."
  for pid in "${PIDS[@]:-}"; do
    [ -n "${pid:-}" ] && kill "$pid" 2>/dev/null || true
  done
  # 포트에 남은 프로세스도 정리 (gradle/next 자식 프로세스 대비)
  for port in "$AI_PORT" "$BACKEND_PORT" "$WEB_PORT"; do
    lsof -ti "tcp:$port" 2>/dev/null | xargs kill -9 2>/dev/null || true
  done
  log "DB/Mailhog 컨테이너는 계속 실행됩니다.  중지: docker compose stop"
}

stop_all() {
  log "정리 중..."
  for port in "$AI_PORT" "$BACKEND_PORT" "$WEB_PORT"; do
    lsof -ti "tcp:$port" 2>/dev/null | xargs kill -9 2>/dev/null || true
  done
  docker stop "$DB_CONTAINER" dev-jobs-mailhog 2>/dev/null || true
  log "완료."
}

if [ "${1:-}" = "--stop" ]; then
  stop_all
  exit 0
fi

# --- 0. DB + Mailhog ---
log "Postgres($DB_CONTAINER) + Mailhog 시작..."
if docker ps -a --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
  docker start "$DB_CONTAINER" >/dev/null
fi
# postgres + mailhog 둘 다 보장 (idempotent)
(cd "$ROOT" && docker compose up -d) >/dev/null

log "DB 헬스체크 대기..."
for i in $(seq 1 30); do
  if docker exec "$DB_CONTAINER" pg_isready -U devjobs -d devjobs >/dev/null 2>&1; then
    log "DB ready."
    break
  fi
  sleep 1
  [ "$i" = 30 ] && { warn "DB 가 준비되지 않았습니다. docker logs $DB_CONTAINER 확인."; exit 1; }
done

mkdir -p "$LOG_DIR"
trap cleanup EXIT INT TERM

# --- 1. AI (8001) ---
log "AI 시작 (포트 $AI_PORT) → $LOG_DIR/ai.log"
( cd "$ROOT/ai" && \
  exec uv run python -m uvicorn app.main:app --host 0.0.0.0 --port "$AI_PORT" --reload \
) >"$LOG_DIR/ai.log" 2>&1 &
PIDS+=($!)

# --- 2. 백엔드 (8080) ---
log "백엔드 시작 (포트 $BACKEND_PORT) → $LOG_DIR/backend.log"
( cd "$ROOT/backend" && \
  PORT="$BACKEND_PORT" \
  AI_BASE_URL="http://localhost:$AI_PORT" \
  JWT_SECRET="$JWT_SECRET" \
  INTERNAL_AUTH_SECRET="$INTERNAL_AUTH_SECRET" \
  APP_BASE_URL="$APP_BASE_URL" \
  MAIL_HOST="$MAIL_HOST" \
  MAIL_PORT="$MAIL_PORT" \
  GITHUB_CLIENT_ID="$GITHUB_CLIENT_ID" \
  GITHUB_CLIENT_SECRET="$GITHUB_CLIENT_SECRET" \
  GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID" \
  GOOGLE_CLIENT_SECRET="$GOOGLE_CLIENT_SECRET" \
  exec ./gradlew bootRun --no-daemon -q \
) >"$LOG_DIR/backend.log" 2>&1 &
PIDS+=($!)

# --- 3. 프론트 (3000) ---
log "프론트 시작 (포트 $WEB_PORT) → $LOG_DIR/web.log"
( cd "$ROOT/web" && \
  PORT="$WEB_PORT" \
  BACKEND_URL="http://localhost:$BACKEND_PORT" \
  BACKEND_PUBLIC_URL="$BACKEND_PUBLIC_URL" \
  JWT_SECRET="$JWT_SECRET" \
  INTERNAL_AUTH_SECRET="$INTERNAL_AUTH_SECRET" \
  APP_BASE_URL="$APP_BASE_URL" \
  exec npm run dev \
) >"$LOG_DIR/web.log" 2>&1 &
PIDS+=($!)

echo
log "기동 중 (백엔드 컴파일에 30~60초 걸릴 수 있음)"
log "  프론트   http://localhost:$WEB_PORT"
log "  백엔드   http://localhost:$BACKEND_PORT/api/v1/jobs"
log "  AI       http://localhost:$AI_PORT/docs"
log "  메일함   http://localhost:8025  (Mailhog — 인증 메일 확인)"
[ -z "$GITHUB_CLIENT_ID" ] && warn "GITHUB_CLIENT_ID 미설정 — GitHub 로그인 비활성 (.env 에 키 입력)"
[ -z "$GOOGLE_CLIENT_ID" ] && warn "GOOGLE_CLIENT_ID 미설정 — Google 로그인 비활성 (.env 에 키 입력)"
log "로그 합쳐 보기: tail -f $LOG_DIR/*.log   (종료: Ctrl+C)"
echo

# 세 로그를 합쳐서 실시간 출력. Ctrl+C 시 trap 이 정리.
tail -f "$LOG_DIR/ai.log" "$LOG_DIR/backend.log" "$LOG_DIR/web.log"
