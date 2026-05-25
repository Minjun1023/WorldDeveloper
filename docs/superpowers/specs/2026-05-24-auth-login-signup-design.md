# 로그인/회원가입 설계 (Spring JWT + OAuth + 이메일 인증)

- 작성일: 2026-05-24
- 브랜치: `feat/auth-login-signup`
- 상태: 설계 확정 (구현 전)

## 1. 목표와 범위

WorldDeveloper에 로그인·회원가입을 추가한다.

- **OAuth**: GitHub, Google 계정으로 로그인 및 가입.
- **이메일/비밀번호**: 이메일+비밀번호로 가입·로그인. **이메일/비밀번호 가입만 인증 메일(링크 클릭)로 이메일을 검증**한다. OAuth는 공급자가 이미 검증한 이메일이라 추가 인증 단계 없음.
- **JWT 발급/검증은 Spring이 단독 소유**한다. Auth.js(next-auth)는 사용하지 않으며 web 티어에서 제거한다.
- **계정 모델은 이메일 기준 통합 계정**: 사람 1명 = `users` 1행. 같은(검증된) 이메일로 GitHub·Google·이메일/비밀번호를 섞어 써도 동일 계정으로 연결한다.

비범위(이번 작업에서 제외): 비밀번호 재설정(분실) 흐름, 리프레시 토큰/세션 무효화 목록, 2FA, 소셜 계정 해제 UI, 관리자/권한(roles). 모두 후속 작업으로 남긴다.

## 2. 현재 상태 (기준선)

- **web** (Next.js 14 + Auth.js v5 beta): `auth.ts`에 GitHub/Google provider, JWT 세션. 그러나 `/signin` 페이지·로그인 UI 없음. `middleware.ts`는 placeholder(모든 `/me/*`를 무조건 `/signin`으로 리다이렉트). `app/api/me/*` 프록시가 `session.user.email`을 `sub`로 하는 HS256 JWT를 `JWT_SECRET`으로 직접 민팅해 Spring에 전달.
- **backend** (Spring): `JwtAuthFilter`가 HS256 JWT의 `sub`를 principal로 주입, `SecurityConfig`가 `/api/v1/applications/**`만 인증 요구. 의존성에 `spring-boot-starter-security`(BCrypt 포함), `jjwt`, `data-jpa`, `flyway`, Testcontainers 보유.
- **db**: `users` 테이블(`id UUID`, `oauth_provider NOT NULL`, `oauth_sub NOT NULL`, `email NULL`, `display_name`, `UNIQUE(oauth_provider, oauth_sub)`)이 정의돼 있으나 영속화하는 `UserEntity`가 없어 **실제로는 비어 있음**. `applications.user_id`는 V2에서 TEXT로 변경됨. 최신 마이그레이션 V5(`nl_profile_cache`).
- 운영 데이터 없음(end-to-end 미검증) → 파괴적 스키마 변경 안전.

## 3. 아키텍처 개요

```
브라우저
  │  (이메일/비번 폼, OAuth 버튼)
  ▼
Next.js (web)  ──서버사이드 프록시──▶  Spring (backend)  ──▶  Postgres
  │  세션 = httpOnly 쿠키(Spring JWT)         │  JWT 발급/검증, 사용자/인증 소유
  │                                          │  OAuth2 Client (GitHub/Google)
  └─ /api/me/* : 쿠키 JWT를 Bearer로 전달      └─ JavaMailSender ──▶ SMTP(로컬 Mailhog)
```

- **Spring이 유일한 JWT 발급자.** OAuth 성공·이메일 로그인 모두 Spring이 JWT(HS256, `JWT_SECRET`, `sub`=`users.id` UUID, exp 7일)를 발급한다.
- **세션 저장**: web 도메인의 httpOnly 쿠키 `session`에 Spring JWT를 담는다. 브라우저는 web하고만 통신하고, web 서버가 쿠키의 JWT를 꺼내 Spring에 `Authorization: Bearer`로 전달한다(기존 프록시 패턴 유지).
- **OAuth 핸드오프**: 브라우저↔공급자 리다이렉트는 Spring이 처리한다. Spring 콜백 완료 후 **일회용 코드**(60초·단회)를 발급해 `${APP_BASE_URL}/auth/callback?code=...`로 리다이렉트하고, web 서버가 Spring `/api/v1/auth/exchange`로 코드→JWT 교환 후 쿠키를 설정한다. JWT가 URL·로그·리퍼러에 노출되지 않는다.

## 4. 데이터 모델 — Flyway `V6__auth_user_accounts.sql`

운영 데이터가 없으므로 `users`를 통합 계정 모델로 재편한다.

`users` 변경:
- `email TEXT NOT NULL` + `UNIQUE` (애플리케이션에서 **소문자로 정규화**해 저장)
- `password_hash TEXT NULL` 추가 (OAuth 전용 사용자는 NULL)
- `email_verified_at TIMESTAMPTZ NULL` 추가 (NULL = 미인증)
- `oauth_provider`, `oauth_sub` 컬럼 **제거** (→ `user_identities`로 이동, `UNIQUE(oauth_provider, oauth_sub)` 제약도 함께 제거)

신규 테이블:
- `user_identities`: `id BIGSERIAL PK`, `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `provider TEXT NOT NULL`(`github`|`google`), `provider_sub TEXT NOT NULL`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `UNIQUE(provider, provider_sub)`
- `email_verification_tokens`: `id BIGSERIAL PK`, `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `token_hash TEXT NOT NULL UNIQUE`(SHA-256 hex), `expires_at TIMESTAMPTZ NOT NULL`, `consumed_at TIMESTAMPTZ NULL`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `oauth_handoff_codes`: `id BIGSERIAL PK`, `code_hash TEXT NOT NULL UNIQUE`(SHA-256 hex), `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `expires_at TIMESTAMPTZ NOT NULL`, `consumed_at TIMESTAMPTZ NULL`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

식별자: JWT `sub` = `users.id`(UUID 문자열). `applications.user_id`는 TEXT라 UUID 문자열을 저장. (기존에 web이 `sub`로 쓰던 email → UUID로 교체.)

`ddl-auto=validate`이므로 신규 JPA 엔티티는 위 스키마와 정확히 일치해야 한다.

## 5. 백엔드 (Spring) — 신규 패키지 `com.devjobs.auth`

### 5.1 의존성 (`backend/build.gradle`)
- 추가: `org.springframework.boot:spring-boot-starter-oauth2-client`
- 추가: `org.springframework.boot:spring-boot-starter-mail`
- 기존 활용: BCrypt(`spring-security-crypto`, starter-security 내장), `jjwt`

### 5.2 엔티티 / 리포지토리
- `UserEntity`(users), `UserIdentityEntity`(user_identities), `EmailVerificationTokenEntity`, `OAuthHandoffCodeEntity` + 각 `JpaRepository`
- 조회: `UserRepository.findByEmail(lower)`, `UserIdentityRepository.findByProviderAndProviderSub`, 토큰/코드는 `findByTokenHash`/`findByCodeHash`

### 5.3 서비스
- `JwtService`
  - `issue(userId)`: HS256, `JWT_SECRET` 서명, `sub`=userId, `exp`=now+7d. (기존 `JwtAuthFilter`와 동일 키)
- `TokenHasher` 유틸: 32바이트 랜덤 생성 + SHA-256 hex (인증 토큰·핸드오프 코드 공용)
- `AuthService`
  - `register(email, password, displayName)`: email 소문자화. 이미 존재하면 분기하되 **계정 열거 방지**용으로 호출자에는 동일한 성공 결과 반환. 신규면 미인증 `users` 생성(`password_hash`=BCrypt, `email_verified_at`=NULL) + 인증 토큰 발급 + 메일 발송.
  - `verifyEmail(rawToken)`: SHA-256 해시로 토큰 조회 → 미소비·미만료면 `email_verified_at`=now, 토큰 `consumed_at`=now(단회용). 무효/만료/소비됨이면 실패.
  - `resendVerification(email)`: 미인증 사용자면 기존 미소비 토큰 정리 후 신규 발급·발송. 계정 열거 방지용 동일 성공 응답.
  - `login(email, password)`: 사용자 없음/`password_hash` 없음(OAuth 전용)→401 일반 응답. `email_verified_at` NULL→403(인증 필요 안내 + 재발송 유도). BCrypt 일치→`JwtService.issue` + 사용자 정보 반환.
  - `oauthUpsert(provider, sub, email, displayName)`: ① `(provider,sub)` 식별자 있으면 그 사용자. ② 없으면 소문자 email로 사용자 조회 → 있으면 새 식별자 연결(OAuth email은 공급자 검증분). ③ 없으면 신규 사용자(`email_verified_at`=now) + 식별자 생성. → 사용자 반환.
- `OAuthHandoffService`
  - `createCode(userId)`: 랜덤 코드 → 해시 저장(60초 TTL) → 원문 코드 반환
  - `exchange(rawCode)`: 해시 조회 → 미소비·미만료면 소비 처리 후 `JwtService.issue` 결과 반환. 아니면 실패.
- `MailService`
  - `sendVerification(email, link)`: `JavaMailSender`로 발송. 메일 미설정(호스트 없음) 시 링크를 WARN 로그로 출력해 로컬 가입이 막히지 않게 한다. 링크 = `${APP_BASE_URL}/verify-email?token=<rawToken>`.
- `RateLimiter`(기존 인메모리) 재사용: register/login/resend per-IP·email 제한.

### 5.4 OAuth (Spring Security OAuth2 Client)
- `application.yml`에 `spring.security.oauth2.client.registration.{github,google}`(client-id/secret=env, scope) + `provider` 설정.
- GitHub은 이메일이 비공개일 수 있으므로 `user:email` 스코프 + 커스텀 `OAuth2UserService`(또는 success handler 내 호출)로 `/user/emails`에서 **verified primary email** 조회.
- 커스텀 `AuthenticationSuccessHandler`: `registrationId`(provider) + sub + email + name 추출 → `AuthService.oauthUpsert` → `OAuthHandoffService.createCode` → `${APP_BASE_URL}/auth/callback?code=...`로 302.

### 5.5 컨트롤러 / 보안
- `AuthController`:
  - `POST /api/v1/auth/register` `{email, password, display_name}` → 200 (열거 방지 일반 응답)
  - `POST /api/v1/auth/login` `{email, password}` → `{token, user_id, email, display_name}` | 401 | 403(미인증)
  - `POST /api/v1/auth/verify-email` `{token}` → 200 | 400
  - `POST /api/v1/auth/resend-verification` `{email}` → 200 (열거 방지)
  - `POST /api/v1/auth/exchange` `{code}` → `{token, user_id, email, display_name}` (**`X-Internal-Auth: ${INTERNAL_AUTH_SECRET}` 전용**, web 서버만 호출)
- `SecurityConfig` 갱신:
  - permitAll: `/api/v1/auth/register`, `/login`, `/verify-email`, `/resend-verification`, `/oauth2/**`, `/login/oauth2/**`
  - `/api/v1/auth/exchange`: 내부 시크릿 헤더 검증(전용 필터 또는 핸들러)
  - `/api/v1/applications/**`: 기존대로 authenticated
  - `oauth2Login(...)` + 커스텀 success handler 등록, 기존 `JwtAuthFilter`(Bearer) 유지
  - `BCryptPasswordEncoder` 빈 추가

## 6. 웹 (Next.js) — `next-auth` 제거

### 6.1 제거
- `next-auth` 의존성, `web/auth.ts`(NextAuth 설정), `app/api/auth/[...nextauth]/route.ts`, `components/providers.tsx`의 `SessionProvider`.

### 6.2 세션
- httpOnly 쿠키 `session` = Spring JWT (web 도메인). `SameSite=Lax`, 운영 `Secure`.
- `lib/session.ts`:
  - `getSession()`(서버): 쿠키 읽어 `jose`로 `JWT_SECRET` 서명·만료 검증 → `{ userId, email, displayName }` | null
  - `setSession(jwt)` / `clearSession()`: 쿠키 set/delete

### 6.3 웹 서버 라우트 (`app/api/auth/*`)
- `POST /api/auth/login` → Spring `/login` → 성공 시 `setSession`, 결과 반환
- `POST /api/auth/register` → Spring `/register` → 결과 반환(열거 방지 그대로 전달)
- `POST /api/auth/verify-email` → Spring `/verify-email`
- `POST /api/auth/resend-verification` → Spring `/resend-verification`
- `POST /api/auth/logout` → `clearSession`
- `GET /api/auth/callback?code` → Spring `/exchange`(`X-Internal-Auth`) → `setSession` → `/`로 리다이렉트

### 6.4 OAuth 시작
- signin/signup의 GitHub·Google 버튼 = `${BACKEND_PUBLIC_URL}/oauth2/authorization/{github,google}` 링크(top-level navigation).
- 운영 주의: Spring의 `/oauth2/**`·`/login/oauth2/**`가 **브라우저에서 도달 가능**해야 한다(공개 또는 동일 게이트웨이). 이를 위해 서버용 `BACKEND_URL`과 브라우저용 `BACKEND_PUBLIC_URL`을 분리(로컬은 둘 다 `http://localhost:8080`).

### 6.5 페이지 / 컴포넌트
- `app/(auth)/signin/page.tsx`: OAuth 버튼 + 이메일/비번 폼 + 가입 링크. `callbackUrl` 지원.
- `app/(auth)/signup/page.tsx`: OAuth 버튼 + 이메일/비번/이름 폼 → 제출 시 "인증 메일을 확인하세요" 안내 + 재발송 버튼.
- `app/verify-email/page.tsx`: `?token` 읽어 `/api/auth/verify-email` 호출 → 성공/실패 UI + 로그인 링크.
- `components/auth/*`(OAuthButtons, EmailPasswordForm, UserMenu) — 기존 `components/ui`(button/input/card) 사용.

### 6.6 미들웨어 / 보호 / 헤더
- `middleware.ts`: placeholder 제거 → `session` 쿠키를 `jose`로 검증해 `/me/*` 보호, 미인증 시 `/signin?callbackUrl=...`로 리다이렉트.
- `app/api/me/*`: SignJWT 민팅 제거 → 쿠키의 Spring JWT를 그대로 `Authorization: Bearer`로 전달. userId가 필요하면 `getSession()` 사용.
- `app/layout.tsx` 헤더 nav에 `UserMenu`(서버 컴포넌트, `getSession()` 기반: 로그인 링크 또는 사용자 표시 + 로그아웃) 추가.

## 7. 인증/토큰 수명주기

- **이메일 인증 토큰**: 32바이트 랜덤. 원문은 메일 링크에만, DB엔 SHA-256 해시. 만료 24시간, 단회용. 재발송 시 기존 미소비 토큰 정리 후 신규 발급.
- **OAuth 일회용 코드**: 랜덤, DB엔 해시. 만료 60초, 단회용.
- **세션 JWT**: HS256, exp 7일. 만료 시 재로그인(리프레시 토큰은 후속).

## 8. 보안 고려사항

- 비밀번호: BCrypt, 최소 8자(서버·클라이언트 검증).
- 계정 열거 방지: `register`/`resend-verification`는 이메일 존재 여부와 무관하게 동일 성공 응답.
- 미인증 로그인: UX를 위해 403 + "이메일 인증 필요" 안내(계정 존재가 드러나는 알려진 트레이드오프 — 명시).
- 토큰·코드: 해시 저장, 단회, 만료. 추측 불가한 난수.
- 비밀/시크릿: `JWT_SECRET`(서명·검증 공유), `INTERNAL_AUTH_SECRET`(web↔Spring exchange), OAuth client secret 모두 env. 운영 쿠키 `Secure`.
- 일회용 코드 교환으로 OAuth JWT의 URL 노출 차단.

## 9. 인프라 / 환경변수

- `docker-compose.yml`: Mailhog 서비스 추가(`1025` SMTP, `8025` UI).
- `backend/src/main/resources/application.yml`: `spring.mail.*`(host/port/from), `spring.security.oauth2.client.*`, `app.base-url`(`${APP_BASE_URL}` — 메일 링크·OAuth 콜백 리다이렉트 대상 web 공개 URL), `auth.internal-secret`(`${INTERNAL_AUTH_SECRET}`) 추가.
- 환경변수(문서: `DEPLOY.md` + `.env.example` 신규):
  - `JWT_SECRET` (기존, 최소 32바이트)
  - `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`
  - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
  - `INTERNAL_AUTH_SECRET`
  - `APP_BASE_URL` (web 공개 URL — 메일 인증 링크 및 OAuth 콜백 리다이렉트 대상; 로컬 `http://localhost:3000`)
  - `BACKEND_URL`(서버사이드, 기존) / `BACKEND_PUBLIC_URL`(브라우저→Spring OAuth; 로컬 `http://localhost:8080`)
  - `MAIL_HOST` / `MAIL_PORT` / `MAIL_USERNAME` / `MAIL_PASSWORD` / `MAIL_FROM` (로컬 Mailhog: host=localhost, port=1025, 인증 없음)

## 10. 테스트 전략

- **백엔드 (JUnit + Testcontainers Postgres)**:
  - `AuthService`: 가입(미인증 생성·메일 발송 호출), 검증(성공·만료·이미소비·무효), 로그인(성공·비번불일치·미인증403·OAuth전용401), `oauthUpsert`(신규 생성 / 식별자 매칭 / 이메일 매칭 연결), 계정 열거 방지 응답.
  - `JwtService`: issue→parse 라운드트립, 만료.
  - `TokenHasher`/`OAuthHandoffService`: 단회·만료.
  - OAuth success handler: 핵심 분기 위주(가능 범위).
- **웹**: `typecheck` + `build` 통과. 미들웨어 보호 동작 수동 확인.
- **수동 E2E**: (1) 이메일 가입 → Mailhog(8025)에서 링크 → 검증 → 로그인 → `/me/applications` 접근. (2) OAuth(키 설정 시): GitHub/Google 로그인 → 콜백 → 세션. (3) 미인증 로그인 차단, 재발송.

## 11. 영향받는 파일 (요약)

- 신규(backend): `com/devjobs/auth/*`(entity/repo/service/controller/handler), `V6__auth_user_accounts.sql`
- 변경(backend): `SecurityConfig`, `application.yml`, `build.gradle`
- 신규(web): `app/(auth)/signin`, `app/(auth)/signup`, `app/verify-email`, `app/api/auth/{login,register,verify-email,resend-verification,logout,callback}`, `lib/session.ts`, `components/auth/*`
- 변경(web): `middleware.ts`, `app/api/me/*`, `app/layout.tsx`, `components/providers.tsx`, `package.json`(next-auth 제거)
- 삭제(web): `auth.ts`, `app/api/auth/[...nextauth]/route.ts`
- 기타: `docker-compose.yml`(Mailhog), `.env.example`(신규), `DEPLOY.md`(env 문서)
