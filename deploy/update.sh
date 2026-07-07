#!/usr/bin/env bash
# 로컬 코드를 OCI 서버로 rsync 한 뒤 재빌드·재기동하는 1줄 배포 업데이트.
#   사용:  ./deploy/update.sh        (repo 어디서 실행해도 됨)
# 동작:
#   1) 소스만 rsync (node_modules/.venv/.git/.env 등 제외 — 서버 deploy/.env 는 보존)
#   2) docker compose up -d --build --remove-orphans  (바뀐 서비스만 재빌드, DB 볼륨 유지,
#      compose 에서 빠진 서비스의 컨테이너는 정리 — 예: 번역 제거 후 libretranslate orphan)
set -euo pipefail

# ── 설정 (환경에 맞게 수정 가능) ──────────────────────────────
SERVER="${DEPLOY_SERVER:-opc@152.67.215.221}"
KEY="${DEPLOY_KEY:-$HOME/.ssh/ssh-key-2026-06-20.key}"
REMOTE_DIR="${DEPLOY_REMOTE_DIR:-~/WorldDeveloper}"
SITE="https://152.67.215.221.sslip.io"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSH_OPTS=(-i "$KEY" -o ConnectTimeout=15 -o ServerAliveInterval=30 -o ServerAliveCountMax=10000)

[ -f "$KEY" ] || { echo "[오류] SSH 키가 없습니다: $KEY"; exit 1; }

echo "[1/3] 소스 동기화 (rsync) ..."
rsync -az --delete \
  --exclude '.git' --exclude 'node_modules' --exclude '.venv' \
  --exclude 'build' --exclude '.next' --exclude 'dist' --exclude '.gradle' \
  --exclude '__pycache__' --exclude '*.pyc' --exclude '.dev-logs' \
  --exclude '.gstack' --exclude '.superpowers' --exclude 'dev-jobs-mcp' \
  --exclude '.env' --exclude '.DS_Store' --exclude '.playwright-mcp' \
  -e "ssh ${SSH_OPTS[*]}" \
  "$REPO_ROOT/" "$SERVER:$REMOTE_DIR/"

echo "[2/4] 이미지 선빌드 (docker compose build) ..."
# 빌드(수 분~수십 분)를 컨테이너 재시작과 분리 — 빌드 동안 기존 스택이 계속 서빙한다.
ssh "${SSH_OPTS[@]}" "$SERVER" \
  "cd $REMOTE_DIR/deploy && sudo docker compose -f docker-compose.prod.yml build"

echo "[3/4] 재기동 (docker compose up -d --remove-orphans) ..."
# 이미지가 이미 준비됐으므로 바뀐 서비스만 수 초 내 교체된다(백엔드 부팅 시간은 별도).
ssh "${SSH_OPTS[@]}" "$SERVER" \
  "cd $REMOTE_DIR/deploy && sudo docker compose -f docker-compose.prod.yml up -d --remove-orphans"

echo "[4/4] 스모크 체크 — 백엔드 준비 대기 후 전 체인 검증 ..."
# /api/jobs/popular = Caddy→web→backend→postgres 전 체인. 백엔드 다운이면 BFF 가 502 를 반환한다.
for i in $(seq 1 36); do
  code=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 8 "$SITE/api/jobs/popular" || true)
  [ "$code" = "200" ] && break
  sleep 5
done
[ "$code" = "200" ] || { echo "[실패] 백엔드 스모크 체크 실패 (마지막 응답: $code)"; exit 1; }
home=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 10 "$SITE/" || true)
[ "$home" = "200" ] || { echo "[실패] 홈 $home"; exit 1; }
echo "스모크 통과 (api 200 · 홈 200)"

ssh "${SSH_OPTS[@]}" "$SERVER" \
  "sudo docker compose -f $REMOTE_DIR/deploy/docker-compose.prod.yml ps --format 'table {{.Service}}\t{{.Status}}'"

echo
echo "완료. → $SITE"
