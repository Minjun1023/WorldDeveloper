FROM python:3.12-slim

# uv 설치
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# 의존성 먼저 (레이어 캐시) — 임베딩(torch) 포함
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --extra embeddings --no-dev

COPY . .

# Railway 는 PORT env 주입
ENV PORT=8001
CMD ["sh", "-c", "uv run python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8001}"]
