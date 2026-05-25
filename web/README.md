# web/ — Next.js 14 (App Router)

TypeScript + Tailwind. 인증은 Spring 이 발급한 JWT 를 httpOnly 쿠키 세션으로 사용한다 (Auth.js 미사용).

## 실행

```bash
cd web
npm install
cp .env.local.example .env.local   # 필요 시 수정
npm run dev
# http://localhost:3000
```

## 구조

```
web/
├── package.json
├── next.config.mjs
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── middleware.ts          /me/* 인증 가드 (세션 쿠키 JWT 를 jose 로 검증)
├── app/
│   ├── layout.tsx         공통 헤더/푸터
│   ├── page.tsx           홈 (backend health 표시)
│   ├── globals.css        Tailwind
│   └── api/health/route.ts  Next.js 자체 헬스
├── lib/
│   └── api.ts             Spring 호출 클라이언트
└── components/            (shadcn/ui 추가 예정)
```

## 환경 변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `BACKEND_URL` | `http://localhost:8080` | Spring API base (서버사이드 프록시) |
| `BACKEND_PUBLIC_URL` | `http://localhost:8080` | 브라우저→Spring OAuth 시작 URL |
| `JWT_SECRET` | (dev 기본값) | 세션 쿠키 JWT 검증. 백엔드와 동일 값 |
| `INTERNAL_AUTH_SECRET` | (dev 기본값) | OAuth code 교환. 백엔드와 동일 값 |
| `APP_BASE_URL` | `http://localhost:3000` | 로그아웃/콜백 리다이렉트 base |

> OAuth Client ID/Secret(GitHub/Google)은 백엔드 env 에 둔다 (Spring 이 OAuth 처리).

## 추후 추가 예정

- shadcn/ui (`npx shadcn@latest init`)
- next-intl (한국어 UI)
- react-hook-form + zod
- recharts (점수 분해 차트)
- Pretendard 폰트 webfont
