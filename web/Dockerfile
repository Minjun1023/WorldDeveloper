# --- build stage ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# NEXT_PUBLIC_* 는 빌드 시점에 클라이언트 번들로 인라인됨(런타임 주입 불가).
# 로고 토큰은 선택 — 없으면 이니셜 폴백.
ARG NEXT_PUBLIC_LOGODEV_TOKEN=""
ENV NEXT_PUBLIC_LOGODEV_TOKEN=$NEXT_PUBLIC_LOGODEV_TOKEN
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- run stage (standalone) ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# standalone 서버가 모든 인터페이스에 바인딩하도록(도커 네트워크 노출).
ENV HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs
COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
