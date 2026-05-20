# web/ — Next.js 14 (App Router)

TypeScript + Tailwind. shadcn/ui / NextAuth 는 W3-W7 에서 점진 추가.

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
├── middleware.ts          /me/* 인증 가드 (W7 에서 NextAuth 검증으로 교체)
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
| `BACKEND_URL` | `http://localhost:8080` | Spring API base |
| `NEXTAUTH_SECRET` | (W7) | NextAuth JWT 서명. Spring 과 동일 값 |
| `GOOGLE_CLIENT_ID/SECRET` | (W7) | Google OAuth |
| `GITHUB_CLIENT_ID/SECRET` | (W7) | GitHub OAuth |

## 추후 추가 예정

- shadcn/ui (`npx shadcn@latest init`)
- next-intl (한국어 UI)
- react-hook-form + zod
- recharts (점수 분해 차트)
- Pretendard 폰트 webfont
