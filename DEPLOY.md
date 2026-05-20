# 배포 가이드

DESIGN.md 토폴로지대로 **web=Vercel, backend/ai=Railway, DB=Neon**. 각 플랫폼이 GitHub repo 와 연동되어 **main push 시 자동 배포**된다 (별도 CD 워크플로 불필요).

> 실제 배포는 각 플랫폼 계정 로그인이 필요하다. 아래 순서대로 진행하면 된다.

## 0. 사전 — 시크릿 2개 생성

```bash
# JWT 서명 시크릿 (backend ↔ web 공유, 최소 32바이트)
openssl rand -base64 48
# NextAuth AUTH_SECRET
openssl rand -base64 32
```

## 1. Neon (Postgres + pgvector)

1. https://neon.tech → 프로젝트 생성 (region: **us-east-1** 권장 — Railway 와 동일)
2. SQL Editor 에서 한 번: `CREATE EXTENSION IF NOT EXISTS vector;` (Flyway 도 시도하지만 권한상 미리 해두면 안전)
3. **Connection string** 복사 → JDBC 형식으로 변환:
   - Neon: `postgresql://user:pass@host/db?sslmode=require`
   - backend 용 JDBC: `jdbc:postgresql://host/db?sslmode=require&user=...&password=...`
   - ai 용: `postgresql://user:pass@host/db?sslmode=require`

## 2. Railway (backend + ai)

프로젝트 생성 → **GitHub repo(WorldDeveloper) 연결** → service 2개 추가:

### backend service
- **Root Directory**: `backend`
- Dockerfile 자동 감지 (`backend/Dockerfile`)
- 환경 변수:
  | 키 | 값 |
  |---|---|
  | `DATABASE_URL` | `jdbc:postgresql://<neon-host>/<db>?sslmode=require&user=...&password=...` |
  | `JWT_SECRET` | (0번에서 생성) |
  | `AI_BASE_URL` | ai service 의 내부 URL (예: `http://ai.railway.internal:8001`) |
- 배포 후 도메인 발급 (예: `dev-jobs-backend.up.railway.app`)

### ai service
- **Root Directory**: `ai`
- Dockerfile 자동 감지 (`ai/Dockerfile`, torch 포함이라 첫 빌드 5~10분)
- 환경 변수:
  | 키 | 값 |
  |---|---|
  | `DATABASE_URL` | `postgresql://user:pass@<neon-host>/<db>?sslmode=require` |
  | `ETL_ENABLED` | `true` (실 공고 자동 수집 시작) |
- 메모리: 임베딩 모델 때문에 **2GB+** 권장

## 3. Vercel (web)

1. https://vercel.com → **GitHub repo 연결**
2. **Root Directory**: `web`
3. Framework: Next.js 자동 감지
4. 환경 변수:
   | 키 | 값 |
   |---|---|
   | `BACKEND_URL` | backend Railway 도메인 (예: `https://dev-jobs-backend.up.railway.app`) |
   | `JWT_SECRET` | (Railway backend 와 **동일** 값) |
   | `AUTH_SECRET` | (0번에서 생성) |
   | `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | GitHub OAuth App |
   | `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth (선택) |

### OAuth App 등록
- GitHub: https://github.com/settings/developers → New OAuth App
  - Homepage: `https://<vercel-domain>`
  - Callback: `https://<vercel-domain>/api/auth/callback/github`
- Google: https://console.cloud.google.com/apis/credentials
  - Callback: `https://<vercel-domain>/api/auth/callback/google`

## 4. 자동 배포 (CD)

연동 끝나면 **`git push origin main` → 3개 플랫폼이 각각 자동 빌드·배포**.
- Vercel: 변경 감지 → 빌드 (web/** 변경 시)
- Railway: 변경 감지 → backend/ai 재빌드
- 롤백: 각 플랫폼 대시보드에서 이전 배포로 1클릭

## 5. 첫 배포 후 체크

```bash
curl https://<backend-domain>/api/v1/health          # {"status":"ok"}
curl https://<backend-domain>/api/v1/jobs             # ETL 돌기 전엔 빈 목록
curl -X POST https://<ai-domain>/internal/etl/trigger # 수동 1회 수집 (또는 ETL_ENABLED 대기)
```

## 비용 (Phase 2 기준)

| | 월 |
|---|---|
| Neon Pro | ~$19 |
| Railway (backend ~$10 + ai 2GB ~$25) | ~$35 |
| Vercel Hobby | $0 |
| **합계** | **~$55** |

## 주의

- **외부 API ToS** (RemoteOK 등 상업 이용) 를 public 공개 전 반드시 확인 (DESIGN.md 섹션 11)
- `JWT_SECRET` 은 backend(Railway) 와 web(Vercel) 에 **동일 값**이어야 인증 동작
- ai service 의 임베딩 모델은 첫 요청 시 ~470MB 다운로드 (메모리 여유 필요)
- ETL 이 외부 API 호출 → Railway egress. 트래픽 폭증 시 rate limit 유의
