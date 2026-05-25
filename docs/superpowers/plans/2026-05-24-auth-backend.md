# Auth Backend (Spring) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spring 백엔드가 OAuth(GitHub/Google) + 이메일/비밀번호 가입·로그인을 처리하고, 이메일 가입만 메일 인증을 거치며, 모든 로그인이 Spring 발급 JWT로 귀결되도록 한다.

**Architecture:** `com.devjobs.auth` 패키지에 사용자/식별자/인증토큰/핸드오프코드 엔티티와 `AuthService`/`OAuthHandoffService`/`JwtService`/`MailService`/`AuthController`를 추가한다. OAuth는 Spring Security OAuth2 Client가 처리하고, 성공 시 일회용 코드를 발급해 web으로 리다이렉트한다. JWT는 기존 `JwtAuthFilter`와 동일한 HS256/`JWT_SECRET`을 쓴다.

**Tech Stack:** Java 17, Spring Boot 3.4.1, Spring Security(+oauth2-client), Spring Data JPA, Flyway, jjwt 0.12.6, BCrypt, JavaMailSender, JUnit5 + Testcontainers(pgvector/pgvector:pg16).

**전제:** 모든 명령은 `cd /Users/mac/WordDeveloper/WorldDeveloper/backend` 기준. 테스트는 Docker 필요(Testcontainers). 스펙: `docs/superpowers/specs/2026-05-24-auth-login-signup-design.md`.

---

### Task 1: 의존성 · 설정 · 인프라 · PasswordEncoder

**Files:**
- Modify: `build.gradle`
- Modify: `src/main/resources/application.yml`
- Modify: `src/main/java/com/devjobs/config/SecurityConfig.java`
- Modify: `../docker-compose.yml`
- Create: `../.env.example`

- [ ] **Step 1: build.gradle 에 mail · oauth2-client 의존성 추가**

`dependencies` 블록의 `// Security + JWT` 그룹 아래에 추가:

```gradle
    // OAuth2 로그인 (GitHub/Google) + 메일 발송
    implementation 'org.springframework.boot:spring-boot-starter-oauth2-client'
    implementation 'org.springframework.boot:spring-boot-starter-mail'
```

- [ ] **Step 2: application.yml 에 mail · oauth2 · app 설정 추가**

기존 `ai:` 블록 위(또는 `jwt:` 근처)에 다음을 추가. **client-id/secret 은 dummy 기본값을 둬 키 없이도 컨텍스트가 기동**한다(키 미설정 시 OAuth 버튼만 동작 안 함).

```yaml
  mail:
    host: ${MAIL_HOST:}
    port: ${MAIL_PORT:1025}
    username: ${MAIL_USERNAME:}
    password: ${MAIL_PASSWORD:}
    properties:
      mail:
        smtp:
          auth: ${MAIL_SMTP_AUTH:false}
          starttls:
            enable: ${MAIL_SMTP_STARTTLS:false}

  security:
    oauth2:
      client:
        registration:
          github:
            client-id: ${GITHUB_CLIENT_ID:dummy-client-id}
            client-secret: ${GITHUB_CLIENT_SECRET:dummy-client-secret}
            scope: read:user,user:email
          google:
            client-id: ${GOOGLE_CLIENT_ID:dummy-client-id}
            client-secret: ${GOOGLE_CLIENT_SECRET:dummy-client-secret}
            scope: openid,email,profile
```

그리고 최상위(루트 레벨, `ai:` 와 같은 들여쓰기)에 `app`/`auth` 블록 추가:

```yaml
app:
  base-url: ${APP_BASE_URL:http://localhost:3000}
  mail-from: ${MAIL_FROM:no-reply@worlddeveloper.local}

auth:
  internal-secret: ${INTERNAL_AUTH_SECRET:dev-internal-secret-change-me}
```

- [ ] **Step 3: SecurityConfig 에 PasswordEncoder 빈 추가**

`SecurityConfig` 클래스 안, `securityFilterChain` 메서드 위에 추가(임포트 2줄도 추가):

```java
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
```

```java
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
```

- [ ] **Step 4: docker-compose.yml 에 Mailhog 추가**

`services:` 아래 `postgres:` 와 같은 레벨로 추가:

```yaml
  mailhog:
    image: mailhog/mailhog:latest
    container_name: dev-jobs-mailhog
    ports:
      - "1025:1025"
      - "8025:8025"
```

- [ ] **Step 5: .env.example 생성**

루트(`../.env.example`)에 생성:

```bash
# --- 공유 JWT 서명 시크릿 (HS256, 최소 32바이트) — web 검증/Spring 발급 공유 ---
JWT_SECRET=dev-local-jwt-secret-change-me-min-32-bytes!!

# --- OAuth (없으면 해당 버튼만 비활성) ---
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# --- web <-> backend 내부 전용 (OAuth code 교환) ---
INTERNAL_AUTH_SECRET=dev-internal-secret-change-me

# --- URL ---
APP_BASE_URL=http://localhost:3000          # web 공개 URL (메일 링크/OAuth 콜백)
BACKEND_URL=http://localhost:8080           # web 서버사이드 -> Spring
BACKEND_PUBLIC_URL=http://localhost:8080    # 브라우저 -> Spring OAuth 시작

# --- 메일 (로컬 Mailhog) ---
MAIL_HOST=localhost
MAIL_PORT=1025
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_FROM=no-reply@worlddeveloper.local
```

- [ ] **Step 6: 컴파일 + 컨텍스트 기동 검증**

Run: `./gradlew test --tests com.devjobs.ApplicationTests`
Expected: PASS (의존성 추가 후에도 Flyway 기존 마이그레이션 + JPA validate + 전체 빈 생성 통과. dummy OAuth 키로도 기동).

- [ ] **Step 7: 커밋**

```bash
git add backend/build.gradle backend/src/main/resources/application.yml backend/src/main/java/com/devjobs/config/SecurityConfig.java docker-compose.yml .env.example
git commit -m "chore(auth): oauth2-client/mail 의존성 + 설정 + Mailhog + PasswordEncoder"
```

---

### Task 2: V6 마이그레이션 + JPA 엔티티 + 리포지토리

**Files:**
- Create: `src/main/resources/db/migration/V6__auth_user_accounts.sql`
- Create: `src/main/java/com/devjobs/auth/UserEntity.java`
- Create: `src/main/java/com/devjobs/auth/UserIdentityEntity.java`
- Create: `src/main/java/com/devjobs/auth/EmailVerificationTokenEntity.java`
- Create: `src/main/java/com/devjobs/auth/OAuthHandoffCodeEntity.java`
- Create: `src/main/java/com/devjobs/auth/UserRepository.java`
- Create: `src/main/java/com/devjobs/auth/UserIdentityRepository.java`
- Create: `src/main/java/com/devjobs/auth/EmailVerificationTokenRepository.java`
- Create: `src/main/java/com/devjobs/auth/OAuthHandoffCodeRepository.java`

- [ ] **Step 1: V6 마이그레이션 작성**

`src/main/resources/db/migration/V6__auth_user_accounts.sql`:

```sql
-- 통합 계정 모델: users 재편 + 식별자/인증토큰/핸드오프코드 테이블
-- (운영 데이터 없음 → 파괴적 변경 안전)

ALTER TABLE users DROP COLUMN oauth_provider;
ALTER TABLE users DROP COLUMN oauth_sub;

ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMPTZ;

-- 이메일은 통합 계정의 자연키 (앱에서 소문자 정규화 저장)
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT uq_users_email UNIQUE (email);

-- OAuth 식별자 (provider, sub) -> user 연결
CREATE TABLE user_identities (
    id            BIGSERIAL PRIMARY KEY,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider      TEXT NOT NULL,
    provider_sub  TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_sub)
);
CREATE INDEX idx_user_identities_user ON user_identities (user_id);

-- 이메일 인증 토큰 (해시 저장, 단회, 만료)
CREATE TABLE email_verification_tokens (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_email_verif_user ON email_verification_tokens (user_id);

-- OAuth 콜백 -> web 핸드오프용 일회용 코드 (해시 저장, 60초 TTL, 단회)
CREATE TABLE oauth_handoff_codes (
    id          BIGSERIAL PRIMARY KEY,
    code_hash   TEXT NOT NULL UNIQUE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at  TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: UserEntity 작성**

`src/main/java/com/devjobs/auth/UserEntity.java`:

```java
package com.devjobs.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "users")
public class UserEntity {

    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "email", nullable = false)
    private String email;

    @Column(name = "password_hash")
    private String passwordHash;

    @Column(name = "email_verified_at")
    private OffsetDateTime emailVerifiedAt;

    @Column(name = "display_name")
    private String displayName;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    protected UserEntity() {}

    public UserEntity(String email, String passwordHash, String displayName) {
        this.id = UUID.randomUUID();
        this.email = email;
        this.passwordHash = passwordHash;
        this.displayName = displayName;
        this.createdAt = OffsetDateTime.now();
    }

    public UUID getId() { return id; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public OffsetDateTime getEmailVerifiedAt() { return emailVerifiedAt; }
    public String getDisplayName() { return displayName; }

    public void markEmailVerified(OffsetDateTime at) { this.emailVerifiedAt = at; }
}
```

- [ ] **Step 3: UserIdentityEntity 작성**

`src/main/java/com/devjobs/auth/UserIdentityEntity.java`:

```java
package com.devjobs.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "user_identities")
public class UserIdentityEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "provider", nullable = false)
    private String provider;

    @Column(name = "provider_sub", nullable = false)
    private String providerSub;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    protected UserIdentityEntity() {}

    public UserIdentityEntity(UUID userId, String provider, String providerSub) {
        this.userId = userId;
        this.provider = provider;
        this.providerSub = providerSub;
        this.createdAt = OffsetDateTime.now();
    }

    public Long getId() { return id; }
    public UUID getUserId() { return userId; }
    public String getProvider() { return provider; }
    public String getProviderSub() { return providerSub; }
}
```

- [ ] **Step 4: EmailVerificationTokenEntity 작성**

`src/main/java/com/devjobs/auth/EmailVerificationTokenEntity.java`:

```java
package com.devjobs.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "email_verification_tokens")
public class EmailVerificationTokenEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "token_hash", nullable = false)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    @Column(name = "consumed_at")
    private OffsetDateTime consumedAt;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    protected EmailVerificationTokenEntity() {}

    public EmailVerificationTokenEntity(UUID userId, String tokenHash, OffsetDateTime expiresAt) {
        this.userId = userId;
        this.tokenHash = tokenHash;
        this.expiresAt = expiresAt;
        this.createdAt = OffsetDateTime.now();
    }

    public UUID getUserId() { return userId; }
    public OffsetDateTime getExpiresAt() { return expiresAt; }
    public OffsetDateTime getConsumedAt() { return consumedAt; }

    public void consume(OffsetDateTime at) { this.consumedAt = at; }
}
```

- [ ] **Step 5: OAuthHandoffCodeEntity 작성**

`src/main/java/com/devjobs/auth/OAuthHandoffCodeEntity.java`:

```java
package com.devjobs.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "oauth_handoff_codes")
public class OAuthHandoffCodeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "code_hash", nullable = false)
    private String codeHash;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    @Column(name = "consumed_at")
    private OffsetDateTime consumedAt;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    protected OAuthHandoffCodeEntity() {}

    public OAuthHandoffCodeEntity(String codeHash, UUID userId, OffsetDateTime expiresAt) {
        this.codeHash = codeHash;
        this.userId = userId;
        this.expiresAt = expiresAt;
        this.createdAt = OffsetDateTime.now();
    }

    public UUID getUserId() { return userId; }
    public OffsetDateTime getExpiresAt() { return expiresAt; }
    public OffsetDateTime getConsumedAt() { return consumedAt; }

    public void consume(OffsetDateTime at) { this.consumedAt = at; }
}
```

- [ ] **Step 6: 리포지토리 4개 작성**

`src/main/java/com/devjobs/auth/UserRepository.java`:

```java
package com.devjobs.auth;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<UserEntity, UUID> {
    Optional<UserEntity> findByEmail(String email);
}
```

`src/main/java/com/devjobs/auth/UserIdentityRepository.java`:

```java
package com.devjobs.auth;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserIdentityRepository extends JpaRepository<UserIdentityEntity, Long> {
    Optional<UserIdentityEntity> findByProviderAndProviderSub(String provider, String providerSub);
}
```

`src/main/java/com/devjobs/auth/EmailVerificationTokenRepository.java`:

```java
package com.devjobs.auth;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmailVerificationTokenRepository
        extends JpaRepository<EmailVerificationTokenEntity, Long> {
    Optional<EmailVerificationTokenEntity> findByTokenHash(String tokenHash);
    void deleteByUserId(UUID userId);
}
```

`src/main/java/com/devjobs/auth/OAuthHandoffCodeRepository.java`:

```java
package com.devjobs.auth;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OAuthHandoffCodeRepository extends JpaRepository<OAuthHandoffCodeEntity, Long> {
    Optional<OAuthHandoffCodeEntity> findByCodeHash(String codeHash);
}
```

- [ ] **Step 7: 마이그레이션 + 엔티티 정합 검증**

Run: `./gradlew test --tests com.devjobs.ApplicationTests`
Expected: PASS — Testcontainers Postgres에서 V1~V6 적용 후 `ddl-auto=validate`가 4개 신규 엔티티를 검증 통과(컬럼/타입 정합). 실패 시 엔티티 `@Column` 이름·nullable이 V6 SQL과 어긋난 것.

- [ ] **Step 8: 커밋**

```bash
git add backend/src/main/resources/db/migration/V6__auth_user_accounts.sql backend/src/main/java/com/devjobs/auth/
git commit -m "feat(auth): V6 통합계정 스키마 + JPA 엔티티/리포지토리"
```

---

### Task 3: TokenHasher (랜덤 토큰 + SHA-256)

**Files:**
- Create: `src/main/java/com/devjobs/auth/TokenHasher.java`
- Test: `src/test/java/com/devjobs/auth/TokenHasherTest.java`

- [ ] **Step 1: 실패 테스트 작성**

`src/test/java/com/devjobs/auth/TokenHasherTest.java`:

```java
package com.devjobs.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class TokenHasherTest {

    @Test
    void randomTokenIsUrlSafeAndUnique() {
        String a = TokenHasher.randomToken();
        String b = TokenHasher.randomToken();
        assertNotEquals(a, b);
        assertTrue(a.matches("[0-9a-f]{64}"), "64 hex chars");
    }

    @Test
    void sha256HexIsStable() {
        assertEquals(TokenHasher.sha256Hex("abc"), TokenHasher.sha256Hex("abc"));
        assertNotEquals(TokenHasher.sha256Hex("abc"), TokenHasher.sha256Hex("abd"));
        assertTrue(TokenHasher.sha256Hex("abc").matches("[0-9a-f]{64}"));
    }
}
```

- [ ] **Step 2: 실패 확인**

Run: `./gradlew test --tests com.devjobs.auth.TokenHasherTest`
Expected: FAIL (컴파일 에러 — `TokenHasher` 없음)

- [ ] **Step 3: 구현**

`src/main/java/com/devjobs/auth/TokenHasher.java`:

```java
package com.devjobs.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.HexFormat;

/** 인증 토큰·핸드오프 코드 공용: 32바이트 난수 hex + SHA-256 hex. */
public final class TokenHasher {

    private static final SecureRandom RANDOM = new SecureRandom();

    private TokenHasher() {}

    public static String randomToken() {
        byte[] b = new byte[32];
        RANDOM.nextBytes(b);
        return HexFormat.of().formatHex(b);
    }

    public static String sha256Hex(String raw) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(raw.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
```

- [ ] **Step 4: 통과 확인**

Run: `./gradlew test --tests com.devjobs.auth.TokenHasherTest`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add backend/src/main/java/com/devjobs/auth/TokenHasher.java backend/src/test/java/com/devjobs/auth/TokenHasherTest.java
git commit -m "feat(auth): TokenHasher (난수 토큰 + SHA-256)"
```

---

### Task 4: JwtService (JWT 발급)

**Files:**
- Create: `src/main/java/com/devjobs/auth/JwtService.java`
- Test: `src/test/java/com/devjobs/auth/JwtServiceTest.java`

- [ ] **Step 1: 실패 테스트 작성**

`src/test/java/com/devjobs/auth/JwtServiceTest.java`:

```java
package com.devjobs.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import javax.crypto.SecretKey;
import org.junit.jupiter.api.Test;

class JwtServiceTest {

    private static final String SECRET = "test-jwt-secret-at-least-32-bytes-long!!";

    @Test
    void issuesTokenWithSubjectAndFutureExpiry() {
        JwtService svc = new JwtService(SECRET, 7);
        String token = svc.issue("user-123");

        SecretKey key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        Claims claims = Jwts.parser().verifyWith(key).build()
            .parseSignedClaims(token).getPayload();

        assertEquals("user-123", claims.getSubject());
        assertTrue(claims.getExpiration().after(new Date()));
    }
}
```

- [ ] **Step 2: 실패 확인**

Run: `./gradlew test --tests com.devjobs.auth.JwtServiceTest`
Expected: FAIL (`JwtService` 없음)

- [ ] **Step 3: 구현**

`src/main/java/com/devjobs/auth/JwtService.java`:

```java
package com.devjobs.auth;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** Spring 이 단독 발급하는 세션 JWT (HS256, JwtAuthFilter 와 동일 시크릿). */
@Service
public class JwtService {

    private final SecretKey key;
    private final long ttlDays;

    public JwtService(@Value("${jwt.secret}") String secret,
                      @Value("${auth.session-ttl-days:7}") long ttlDays) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.ttlDays = ttlDays;
    }

    public String issue(String userId) {
        Instant now = Instant.now();
        return Jwts.builder()
            .subject(userId)
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plus(Duration.ofDays(ttlDays))))
            .signWith(key)
            .compact();
    }
}
```

- [ ] **Step 4: 통과 확인**

Run: `./gradlew test --tests com.devjobs.auth.JwtServiceTest`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add backend/src/main/java/com/devjobs/auth/JwtService.java backend/src/test/java/com/devjobs/auth/JwtServiceTest.java
git commit -m "feat(auth): JwtService (HS256 세션 토큰 발급)"
```

---

### Task 5: MailService (인증 메일 + 미설정 시 로그 폴백)

**Files:**
- Create: `src/main/java/com/devjobs/auth/MailService.java`
- Test: `src/test/java/com/devjobs/auth/MailServiceTest.java`

- [ ] **Step 1: 실패 테스트 작성**

`src/test/java/com/devjobs/auth/MailServiceTest.java`:

```java
package com.devjobs.auth;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

class MailServiceTest {

    @Test
    void sendsWhenSenderPresent() {
        JavaMailSender sender = Mockito.mock(JavaMailSender.class);
        MailService svc = new MailService(sender, "no-reply@x.dev");
        svc.sendVerification("u@x.dev", "http://app/verify-email?token=abc");

        ArgumentCaptor<SimpleMailMessage> cap = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(sender).send(cap.capture());
    }

    @Test
    void logsAndSkipsWhenSenderNull() {
        MailService svc = new MailService(null, "no-reply@x.dev");
        // sender 없음 → 예외 없이 로그 폴백
        svc.sendVerification("u@x.dev", "http://app/verify-email?token=abc");
    }
}
```

- [ ] **Step 2: 실패 확인**

Run: `./gradlew test --tests com.devjobs.auth.MailServiceTest`
Expected: FAIL (`MailService` 없음)

- [ ] **Step 3: 구현**

`src/main/java/com/devjobs/auth/MailService.java`:

```java
package com.devjobs.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * 인증 메일 발송. JavaMailSender 빈이 없으면(=spring.mail.host 미설정) 링크를 로그로 출력해
 * 로컬 가입이 막히지 않게 한다.
 */
@Service
public class MailService {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    private final JavaMailSender sender; // null 가능
    private final String from;

    // Spring 빈 생성용
    public MailService(ObjectProvider<JavaMailSender> senderProvider,
                       @Value("${app.mail-from}") String from) {
        this(senderProvider.getIfAvailable(), from);
    }

    // 테스트/직접 생성용
    MailService(JavaMailSender sender, String from) {
        this.sender = sender;
        this.from = from;
    }

    public void sendVerification(String email, String link) {
        if (sender == null) {
            log.warn("[MAIL DISABLED] {} 의 이메일 인증 링크: {}", email, link);
            return;
        }
        SimpleMailMessage msg = new SimpleMailMessage();
        msg.setFrom(from);
        msg.setTo(email);
        msg.setSubject("[WorldDeveloper] 이메일 인증");
        msg.setText("아래 링크를 눌러 이메일을 인증하세요 (24시간 유효):\n\n" + link);
        sender.send(msg);
    }
}
```

- [ ] **Step 4: 통과 확인**

Run: `./gradlew test --tests com.devjobs.auth.MailServiceTest`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add backend/src/main/java/com/devjobs/auth/MailService.java backend/src/test/java/com/devjobs/auth/MailServiceTest.java
git commit -m "feat(auth): MailService (인증 메일 + 로그 폴백)"
```

---

### Task 6: AuthDtos + AuthService.register

**Files:**
- Create: `src/main/java/com/devjobs/auth/dto/AuthDtos.java`
- Create: `src/main/java/com/devjobs/auth/AuthService.java`
- Test: `src/test/java/com/devjobs/auth/AuthServiceTest.java`

이후 Task 7~9, 11 은 같은 `AuthService` 와 `AuthServiceTest` 에 메서드/테스트를 추가한다.

- [ ] **Step 1: AuthDtos 작성**

`src/main/java/com/devjobs/auth/dto/AuthDtos.java`:

```java
package com.devjobs.auth.dto;

public final class AuthDtos {

    private AuthDtos() {}

    public record RegisterRequest(String email, String password, String displayName) {}
    public record LoginRequest(String email, String password) {}
    public record VerifyRequest(String token) {}
    public record ResendRequest(String email) {}
    public record ExchangeRequest(String code) {}

    /** login / exchange 응답: 세션 JWT + 사용자 식별 정보 */
    public record AuthResult(String token, String userId, String email, String displayName) {}
}
```

- [ ] **Step 2: register 실패 테스트 작성**

`src/test/java/com/devjobs/auth/AuthServiceTest.java`:

```java
package com.devjobs.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;

import com.devjobs.auth.dto.AuthDtos.AuthResult;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@SpringBootTest
@Testcontainers
@Transactional
class AuthServiceTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(
        DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));

    @MockBean
    MailService mailService; // SMTP 회피

    @Autowired AuthService authService;
    @Autowired UserRepository userRepo;
    @Autowired EmailVerificationTokenRepository tokenRepo;

    @Test
    void registerCreatesUnverifiedUserAndSendsMail() {
        authService.register("New@Example.com", "password123", "New User");

        UserEntity u = userRepo.findByEmail("new@example.com").orElseThrow();
        assertNotNull(u.getPasswordHash());
        assertTrue(u.getPasswordHash().startsWith("$2"), "BCrypt 해시");
        assertNull(u.getEmailVerifiedAt(), "가입 직후 미인증");
        verify(mailService, times(1)).sendVerification(org.mockito.ArgumentMatchers.eq("new@example.com"),
            org.mockito.ArgumentMatchers.contains("/verify-email?token="));
    }

    @Test
    void registerDuplicateEmailIsEnumerationSafeNoop() {
        authService.register("dup@example.com", "password123", "A");
        org.mockito.Mockito.reset(mailService);
        // 같은 이메일 재가입 시도 → 예외 없이 조용히 반환, 메일 미발송
        authService.register("dup@example.com", "otherpass456", "B");
        verifyNoMoreInteractions(mailService);
        assertEquals(1, userRepo.findByEmail("dup@example.com").stream().count());
    }
}
```

- [ ] **Step 3: 실패 확인**

Run: `./gradlew test --tests com.devjobs.auth.AuthServiceTest`
Expected: FAIL (`AuthService` 없음)

- [ ] **Step 4: AuthService 작성 (register + 내부 헬퍼)**

`src/main/java/com/devjobs/auth/AuthService.java`:

```java
package com.devjobs.auth;

import java.time.OffsetDateTime;
import java.util.Locale;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository userRepo;
    private final UserIdentityRepository identityRepo;
    private final EmailVerificationTokenRepository tokenRepo;
    private final PasswordEncoder passwordEncoder;
    private final MailService mailService;
    private final String appBaseUrl;

    public AuthService(UserRepository userRepo,
                       UserIdentityRepository identityRepo,
                       EmailVerificationTokenRepository tokenRepo,
                       PasswordEncoder passwordEncoder,
                       MailService mailService,
                       @Value("${app.base-url}") String appBaseUrl) {
        this.userRepo = userRepo;
        this.identityRepo = identityRepo;
        this.tokenRepo = tokenRepo;
        this.passwordEncoder = passwordEncoder;
        this.mailService = mailService;
        this.appBaseUrl = appBaseUrl;
    }

    private static String normalize(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }

    @Transactional
    public void register(String email, String rawPassword, String displayName) {
        String norm = normalize(email);
        if (userRepo.findByEmail(norm).isPresent()) {
            return; // 계정 열거 방지: 조용히 반환
        }
        UserEntity u = new UserEntity(norm, passwordEncoder.encode(rawPassword), displayName);
        userRepo.save(u);
        issueAndSendVerification(u);
    }

    private void issueAndSendVerification(UserEntity u) {
        String raw = TokenHasher.randomToken();
        EmailVerificationTokenEntity t = new EmailVerificationTokenEntity(
            u.getId(), TokenHasher.sha256Hex(raw), OffsetDateTime.now().plusHours(24));
        tokenRepo.save(t);
        mailService.sendVerification(u.getEmail(), appBaseUrl + "/verify-email?token=" + raw);
    }
}
```

- [ ] **Step 5: 통과 확인**

Run: `./gradlew test --tests com.devjobs.auth.AuthServiceTest`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add backend/src/main/java/com/devjobs/auth/dto/AuthDtos.java backend/src/main/java/com/devjobs/auth/AuthService.java backend/src/test/java/com/devjobs/auth/AuthServiceTest.java
git commit -m "feat(auth): AuthDtos + AuthService.register"
```

---

### Task 7: AuthService.verifyEmail

**Files:**
- Modify: `src/main/java/com/devjobs/auth/AuthService.java`
- Modify: `src/test/java/com/devjobs/auth/AuthServiceTest.java`

- [ ] **Step 1: 실패 테스트 추가**

`AuthServiceTest` 에 메서드 추가(클래스 상단 import 에 `import org.springframework.web.server.ResponseStatusException;`, `import static org.junit.jupiter.api.Assertions.assertThrows;` 추가):

```java
    @Test
    void verifyEmailMarksUserVerifiedAndConsumesToken() {
        authService.register("verify@example.com", "password123", "V");
        // register 가 만든 토큰의 원문은 메일로만 나가므로, 테스트는 새 토큰을 직접 발급해 검증 경로를 탄다
        UserEntity u = userRepo.findByEmail("verify@example.com").orElseThrow();
        String raw = TokenHasher.randomToken();
        tokenRepo.save(new EmailVerificationTokenEntity(
            u.getId(), TokenHasher.sha256Hex(raw), java.time.OffsetDateTime.now().plusHours(1)));

        authService.verifyEmail(raw);

        assertNotNull(userRepo.findByEmail("verify@example.com").orElseThrow().getEmailVerifiedAt());
        // 단회용: 같은 토큰 재사용 시 실패
        assertThrows(ResponseStatusException.class, () -> authService.verifyEmail(raw));
    }

    @Test
    void verifyEmailRejectsUnknownToken() {
        assertThrows(ResponseStatusException.class, () -> authService.verifyEmail("deadbeef"));
    }
```

- [ ] **Step 2: 실패 확인**

Run: `./gradlew test --tests com.devjobs.auth.AuthServiceTest`
Expected: FAIL (`verifyEmail` 없음)

- [ ] **Step 3: verifyEmail 구현 (AuthService 에 추가)**

import 추가: `import org.springframework.http.HttpStatus;`, `import org.springframework.web.server.ResponseStatusException;`

```java
    @Transactional
    public void verifyEmail(String rawToken) {
        EmailVerificationTokenEntity t = tokenRepo.findByTokenHash(TokenHasher.sha256Hex(rawToken))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid_token"));
        if (t.getConsumedAt() != null || t.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid_token");
        }
        UserEntity u = userRepo.findById(t.getUserId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid_token"));
        u.markEmailVerified(OffsetDateTime.now());
        t.consume(OffsetDateTime.now());
    }
```

- [ ] **Step 4: 통과 확인**

Run: `./gradlew test --tests com.devjobs.auth.AuthServiceTest`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add backend/src/main/java/com/devjobs/auth/AuthService.java backend/src/test/java/com/devjobs/auth/AuthServiceTest.java
git commit -m "feat(auth): AuthService.verifyEmail (단회·만료)"
```

---

### Task 8: AuthService.resendVerification

**Files:**
- Modify: `src/main/java/com/devjobs/auth/AuthService.java`
- Modify: `src/test/java/com/devjobs/auth/AuthServiceTest.java`

- [ ] **Step 1: 실패 테스트 추가**

```java
    @Test
    void resendForUnverifiedUserSendsNewMail() {
        authService.register("resend@example.com", "password123", "R");
        org.mockito.Mockito.reset(mailService);
        authService.resendVerification("resend@example.com");
        verify(mailService, times(1)).sendVerification(
            org.mockito.ArgumentMatchers.eq("resend@example.com"),
            org.mockito.ArgumentMatchers.contains("/verify-email?token="));
    }

    @Test
    void resendForUnknownEmailIsEnumerationSafeNoop() {
        authService.resendVerification("nobody@example.com"); // 예외 없음, 메일 없음
        verifyNoMoreInteractions(mailService);
    }
```

- [ ] **Step 2: 실패 확인**

Run: `./gradlew test --tests com.devjobs.auth.AuthServiceTest`
Expected: FAIL (`resendVerification` 없음)

- [ ] **Step 3: resendVerification 구현 (AuthService 에 추가)**

```java
    @Transactional
    public void resendVerification(String email) {
        Optional<UserEntity> ou = userRepo.findByEmail(normalize(email));
        if (ou.isEmpty()) return;                       // 열거 방지
        UserEntity u = ou.get();
        if (u.getEmailVerifiedAt() != null) return;     // 이미 인증됨
        if (u.getPasswordHash() == null) return;         // OAuth 전용 계정 — 해당 없음
        tokenRepo.deleteByUserId(u.getId());             // 이전 토큰 정리
        issueAndSendVerification(u);
    }
```

- [ ] **Step 4: 통과 확인**

Run: `./gradlew test --tests com.devjobs.auth.AuthServiceTest`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add backend/src/main/java/com/devjobs/auth/AuthService.java backend/src/test/java/com/devjobs/auth/AuthServiceTest.java
git commit -m "feat(auth): AuthService.resendVerification"
```

---

### Task 9: AuthService.login

**Files:**
- Modify: `src/main/java/com/devjobs/auth/AuthService.java`
- Modify: `src/test/java/com/devjobs/auth/AuthServiceTest.java`

login 은 `JwtService` 가 필요하므로 생성자에 주입한다.

- [ ] **Step 1: 실패 테스트 추가**

import 추가: `import com.devjobs.auth.dto.AuthDtos.AuthResult;` (이미 있음), `import org.springframework.http.HttpStatus;`

```java
    @Test
    void loginSucceedsAfterVerification() {
        authService.register("login@example.com", "password123", "L");
        UserEntity u = userRepo.findByEmail("login@example.com").orElseThrow();
        u.markEmailVerified(java.time.OffsetDateTime.now());
        userRepo.save(u);

        AuthResult res = authService.login("login@example.com", "password123");
        assertNotNull(res.token());
        assertEquals(u.getId().toString(), res.userId());
        assertEquals("login@example.com", res.email());
    }

    @Test
    void loginBlockedWhenEmailNotVerified() {
        authService.register("unverified@example.com", "password123", "U");
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
            () -> authService.login("unverified@example.com", "password123"));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }

    @Test
    void loginRejectsWrongPassword() {
        authService.register("wrong@example.com", "password123", "W");
        UserEntity u = userRepo.findByEmail("wrong@example.com").orElseThrow();
        u.markEmailVerified(java.time.OffsetDateTime.now());
        userRepo.save(u);
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
            () -> authService.login("wrong@example.com", "nope"));
        assertEquals(HttpStatus.UNAUTHORIZED, ex.getStatusCode());
    }
```

- [ ] **Step 2: 실패 확인**

Run: `./gradlew test --tests com.devjobs.auth.AuthServiceTest`
Expected: FAIL (`login` 없음)

- [ ] **Step 3: 생성자에 JwtService 주입 + login 구현**

`AuthService` 필드/생성자 수정 — `private final JwtService jwtService;` 추가, 생성자 인자에 `JwtService jwtService` 추가하고 `this.jwtService = jwtService;` 대입. import 추가: `import com.devjobs.auth.dto.AuthDtos.AuthResult;`

메서드 추가:

```java
    @Transactional(readOnly = true)
    public AuthResult login(String email, String rawPassword) {
        UserEntity u = userRepo.findByEmail(normalize(email))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid_credentials"));
        if (u.getPasswordHash() == null || !passwordEncoder.matches(rawPassword, u.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid_credentials");
        }
        if (u.getEmailVerifiedAt() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "email_not_verified");
        }
        String token = jwtService.issue(u.getId().toString());
        return new AuthResult(token, u.getId().toString(), u.getEmail(), u.getDisplayName());
    }
```

- [ ] **Step 4: 통과 확인**

Run: `./gradlew test --tests com.devjobs.auth.AuthServiceTest`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add backend/src/main/java/com/devjobs/auth/AuthService.java backend/src/test/java/com/devjobs/auth/AuthServiceTest.java
git commit -m "feat(auth): AuthService.login (미인증 403/오류 401 + JWT)"
```

---

### Task 10: OAuthHandoffService (일회용 코드)

**Files:**
- Create: `src/main/java/com/devjobs/auth/OAuthHandoffService.java`
- Test: `src/test/java/com/devjobs/auth/OAuthHandoffServiceTest.java`

- [ ] **Step 1: 실패 테스트 작성**

`src/test/java/com/devjobs/auth/OAuthHandoffServiceTest.java`:

```java
package com.devjobs.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.devjobs.auth.dto.AuthDtos.AuthResult;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@SpringBootTest
@Testcontainers
@Transactional
class OAuthHandoffServiceTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(
        DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));

    @Autowired OAuthHandoffService handoff;
    @Autowired UserRepository userRepo;

    @Test
    void createThenExchangeReturnsTokenOnce() {
        UserEntity u = userRepo.save(new UserEntity("handoff@example.com", null, "H"));
        String code = handoff.createCode(u.getId().toString());
        assertNotNull(code);

        AuthResult res = handoff.exchange(code);
        assertEquals(u.getId().toString(), res.userId());
        assertNotNull(res.token());

        // 단회용
        assertThrows(ResponseStatusException.class, () -> handoff.exchange(code));
    }

    @Test
    void exchangeRejectsUnknownCode() {
        assertThrows(ResponseStatusException.class, () -> handoff.exchange("nope"));
    }
}
```

- [ ] **Step 2: 실패 확인**

Run: `./gradlew test --tests com.devjobs.auth.OAuthHandoffServiceTest`
Expected: FAIL (`OAuthHandoffService` 없음)

- [ ] **Step 3: 구현**

`src/main/java/com/devjobs/auth/OAuthHandoffService.java`:

```java
package com.devjobs.auth;

import com.devjobs.auth.dto.AuthDtos.AuthResult;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** OAuth 콜백 -> web 핸드오프: 60초·단회 코드를 발급/교환한다. */
@Service
public class OAuthHandoffService {

    private final OAuthHandoffCodeRepository repo;
    private final UserRepository userRepo;
    private final JwtService jwtService;

    public OAuthHandoffService(OAuthHandoffCodeRepository repo,
                               UserRepository userRepo,
                               JwtService jwtService) {
        this.repo = repo;
        this.userRepo = userRepo;
        this.jwtService = jwtService;
    }

    @Transactional
    public String createCode(String userId) {
        String raw = TokenHasher.randomToken();
        repo.save(new OAuthHandoffCodeEntity(
            TokenHasher.sha256Hex(raw), UUID.fromString(userId),
            OffsetDateTime.now().plusSeconds(60)));
        return raw;
    }

    @Transactional
    public AuthResult exchange(String rawCode) {
        OAuthHandoffCodeEntity c = repo.findByCodeHash(TokenHasher.sha256Hex(rawCode))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid_code"));
        if (c.getConsumedAt() != null || c.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid_code");
        }
        c.consume(OffsetDateTime.now());
        UserEntity u = userRepo.findById(c.getUserId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid_code"));
        return new AuthResult(jwtService.issue(u.getId().toString()),
            u.getId().toString(), u.getEmail(), u.getDisplayName());
    }
}
```

- [ ] **Step 4: 통과 확인**

Run: `./gradlew test --tests com.devjobs.auth.OAuthHandoffServiceTest`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add backend/src/main/java/com/devjobs/auth/OAuthHandoffService.java backend/src/test/java/com/devjobs/auth/OAuthHandoffServiceTest.java
git commit -m "feat(auth): OAuthHandoffService (60초 단회 코드 교환)"
```

---

### Task 11: AuthService.oauthUpsert

**Files:**
- Modify: `src/main/java/com/devjobs/auth/AuthService.java`
- Modify: `src/test/java/com/devjobs/auth/AuthServiceTest.java`

- [ ] **Step 1: 실패 테스트 추가**

import 추가: `import org.springframework.beans.factory.annotation.Autowired;` (이미 있음) — `UserIdentityRepository` 주입 필드 추가:

```java
    @Autowired UserIdentityRepository identityRepo;
```

테스트 메서드:

```java
    @Test
    void oauthUpsertCreatesNewUserWhenNoMatch() {
        UserEntity u = authService.oauthUpsert("google", "g-sub-1", "OAuth@Example.com", "OAuth User");
        assertNotNull(u.getId());
        assertEquals("oauth@example.com", u.getEmail());
        assertNotNull(u.getEmailVerifiedAt(), "OAuth 이메일은 공급자 검증분 → 즉시 인증");
        assertTrue(identityRepo.findByProviderAndProviderSub("google", "g-sub-1").isPresent());
    }

    @Test
    void oauthUpsertReturnsExistingByIdentity() {
        UserEntity first = authService.oauthUpsert("github", "gh-1", "same@example.com", "X");
        UserEntity again = authService.oauthUpsert("github", "gh-1", "same@example.com", "X");
        assertEquals(first.getId(), again.getId());
    }

    @Test
    void oauthUpsertLinksToExistingUserByVerifiedEmail() {
        // 이메일/비번으로 먼저 가입 + 인증
        authService.register("link@example.com", "password123", "Link");
        UserEntity u = userRepo.findByEmail("link@example.com").orElseThrow();
        u.markEmailVerified(java.time.OffsetDateTime.now());
        userRepo.save(u);
        // 같은 이메일로 Google 로그인 → 동일 계정에 식별자만 연결
        UserEntity linked = authService.oauthUpsert("google", "g-link", "link@example.com", "Link");
        assertEquals(u.getId(), linked.getId());
        assertTrue(identityRepo.findByProviderAndProviderSub("google", "g-link").isPresent());
    }
```

- [ ] **Step 2: 실패 확인**

Run: `./gradlew test --tests com.devjobs.auth.AuthServiceTest`
Expected: FAIL (`oauthUpsert` 없음)

- [ ] **Step 3: oauthUpsert 구현 (AuthService 에 추가)**

```java
    @Transactional
    public UserEntity oauthUpsert(String provider, String providerSub, String email, String displayName) {
        Optional<UserIdentityEntity> existingIdentity =
            identityRepo.findByProviderAndProviderSub(provider, providerSub);
        if (existingIdentity.isPresent()) {
            return userRepo.findById(existingIdentity.get().getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "user_missing"));
        }
        String norm = normalize(email);
        if (norm == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "oauth_email_required");
        }
        UserEntity user = userRepo.findByEmail(norm).orElse(null);
        if (user == null) {
            user = new UserEntity(norm, null, displayName); // OAuth 전용: password_hash = null
            user.markEmailVerified(OffsetDateTime.now());    // 공급자 검증분
            userRepo.save(user);
        }
        identityRepo.save(new UserIdentityEntity(user.getId(), provider, providerSub));
        return user;
    }
```

- [ ] **Step 4: 통과 확인**

Run: `./gradlew test --tests com.devjobs.auth.AuthServiceTest`
Expected: PASS (전 케이스)

- [ ] **Step 5: 커밋**

```bash
git add backend/src/main/java/com/devjobs/auth/AuthService.java backend/src/test/java/com/devjobs/auth/AuthServiceTest.java
git commit -m "feat(auth): AuthService.oauthUpsert (식별자/이메일 연결 + 신규)"
```

---

### Task 12: AuthController + 내부 시크릿 + SecurityConfig permitAll

**Files:**
- Create: `src/main/java/com/devjobs/auth/AuthController.java`
- Modify: `src/main/java/com/devjobs/config/SecurityConfig.java`
- Test: `src/test/java/com/devjobs/auth/AuthControllerTest.java`

- [ ] **Step 1: SecurityConfig 에 auth 경로 permitAll 추가**

`SecurityConfig.securityFilterChain` 의 `authorizeHttpRequests` 를 다음으로 교체(명시적 permitAll — `anyRequest().permitAll()` 가 이미 있으나 의도를 드러내고, 추후 규칙 추가 대비):

```java
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/v1/auth/**").permitAll()
                .requestMatchers("/oauth2/**", "/login/oauth2/**").permitAll()
                .requestMatchers("/api/v1/applications/**").authenticated()
                .anyRequest().permitAll()
            )
```

- [ ] **Step 2: 실패 테스트 작성**

`src/test/java/com/devjobs/auth/AuthControllerTest.java`:

```java
package com.devjobs.auth;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class AuthControllerTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(
        DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));

    @MockBean MailService mailService;

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper om;

    private String json(Map<String, ?> m) throws Exception { return om.writeValueAsString(m); }

    @Test
    void registerReturns200() throws Exception {
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("email", "ctrl-reg@example.com", "password", "password123", "displayName", "C"))))
            .andExpect(status().isOk());
    }

    @Test
    void loginUnverifiedReturns403() throws Exception {
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("email", "ctrl-unv@example.com", "password", "password123", "displayName", "C"))))
            .andExpect(status().isOk());
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("email", "ctrl-unv@example.com", "password", "password123"))))
            .andExpect(status().isForbidden());
    }

    @Test
    void exchangeWithoutInternalSecretIsUnauthorized() throws Exception {
        mvc.perform(post("/api/v1/auth/exchange").contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("code", "whatever"))))
            .andExpect(status().isUnauthorized());
    }
}
```

- [ ] **Step 3: 실패 확인**

Run: `./gradlew test --tests com.devjobs.auth.AuthControllerTest`
Expected: FAIL (`AuthController` 없음 → 404, 또는 컴파일 에러)

- [ ] **Step 4: AuthController 구현**

`src/main/java/com/devjobs/auth/AuthController.java`:

```java
package com.devjobs.auth;

import com.devjobs.auth.dto.AuthDtos.AuthResult;
import com.devjobs.auth.dto.AuthDtos.ExchangeRequest;
import com.devjobs.auth.dto.AuthDtos.LoginRequest;
import com.devjobs.auth.dto.AuthDtos.RegisterRequest;
import com.devjobs.auth.dto.AuthDtos.ResendRequest;
import com.devjobs.auth.dto.AuthDtos.VerifyRequest;
import com.devjobs.strategist.RateLimiter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService auth;
    private final OAuthHandoffService handoff;
    private final RateLimiter rateLimiter;
    private final String internalSecret;

    public AuthController(AuthService auth,
                          OAuthHandoffService handoff,
                          RateLimiter rateLimiter,
                          @Value("${auth.internal-secret}") String internalSecret) {
        this.auth = auth;
        this.handoff = handoff;
        this.rateLimiter = rateLimiter;
        this.internalSecret = internalSecret;
    }

    private void rateLimit(String action, HttpServletRequest req) {
        if (!rateLimiter.tryAcquire(action + ":" + req.getRemoteAddr())) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "rate_limited");
        }
    }

    @PostMapping("/register")
    public ResponseEntity<Void> register(@RequestBody RegisterRequest r, HttpServletRequest req) {
        rateLimit("register", req);
        auth.register(r.email(), r.password(), r.displayName());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/login")
    public AuthResult login(@RequestBody LoginRequest r, HttpServletRequest req) {
        rateLimit("login", req);
        return auth.login(r.email(), r.password());
    }

    @PostMapping("/verify-email")
    public ResponseEntity<Void> verify(@RequestBody VerifyRequest r) {
        auth.verifyEmail(r.token());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/resend-verification")
    public ResponseEntity<Void> resend(@RequestBody ResendRequest r, HttpServletRequest req) {
        rateLimit("resend", req);
        auth.resendVerification(r.email());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/exchange")
    public AuthResult exchange(@RequestHeader(value = "X-Internal-Auth", required = false) String secret,
                               @RequestBody ExchangeRequest r) {
        if (internalSecret == null || internalSecret.isBlank() || !internalSecret.equals(secret)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "forbidden");
        }
        return handoff.exchange(r.code());
    }
}
```

- [ ] **Step 5: 통과 확인**

Run: `./gradlew test --tests com.devjobs.auth.AuthControllerTest`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add backend/src/main/java/com/devjobs/auth/AuthController.java backend/src/main/java/com/devjobs/config/SecurityConfig.java backend/src/test/java/com/devjobs/auth/AuthControllerTest.java
git commit -m "feat(auth): AuthController (+ /exchange 내부시크릿) + permitAll 경로"
```

---

### Task 13: OAuth 로그인 (UserService + SuccessHandler + SecurityConfig)

**Files:**
- Create: `src/main/java/com/devjobs/auth/CustomOAuth2UserService.java`
- Create: `src/main/java/com/devjobs/auth/OAuthSuccessHandler.java`
- Modify: `src/main/java/com/devjobs/config/SecurityConfig.java`
- Test: `src/test/java/com/devjobs/auth/OAuthSuccessHandlerTest.java`

- [ ] **Step 1: CustomOAuth2UserService 작성 (GitHub verified primary email 보강)**

`src/main/java/com/devjobs/auth/CustomOAuth2UserService.java`:

```java
package com.devjobs.auth;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

/**
 * GitHub 은 primary email 이 비공개면 /userinfo 에 email 이 없다.
 * user:email 스코프로 /user/emails 를 조회해 verified primary email 을 attributes 에 보강한다.
 */
@Service
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    private final RestClient restClient = RestClient.create();

    @Override
    public OAuth2User loadUser(OAuth2UserRequest req) throws OAuth2AuthenticationException {
        OAuth2User user = super.loadUser(req);
        String registrationId = req.getClientRegistration().getRegistrationId();

        if (!"github".equals(registrationId) || user.getAttribute("email") != null) {
            return user;
        }

        String primaryEmail = fetchGithubPrimaryEmail(req.getAccessToken().getTokenValue());
        if (primaryEmail == null) {
            return user;
        }

        Map<String, Object> merged = new HashMap<>(user.getAttributes());
        merged.put("email", primaryEmail);
        String nameAttrKey = req.getClientRegistration().getProviderDetails()
            .getUserInfoEndpoint().getUserNameAttributeName();
        return new DefaultOAuth2User(new ArrayList<>(user.getAuthorities()), merged, nameAttrKey);
    }

    private String fetchGithubPrimaryEmail(String accessToken) {
        List<Map<String, Object>> emails = restClient.get()
            .uri("https://api.github.com/user/emails")
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
            .header("Accept", "application/vnd.github+json")
            .retrieve()
            .body(new ParameterizedTypeReference<List<Map<String, Object>>>() {});
        if (emails == null) return null;
        for (Map<String, Object> e : emails) {
            if (Boolean.TRUE.equals(e.get("primary")) && Boolean.TRUE.equals(e.get("verified"))) {
                return (String) e.get("email");
            }
        }
        return null;
    }
}
```

- [ ] **Step 2: OAuthSuccessHandler 실패 테스트 작성**

`src/test/java/com/devjobs/auth/OAuthSuccessHandlerTest.java`:

```java
package com.devjobs.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;

class OAuthSuccessHandlerTest {

    @Test
    void redirectsToWebCallbackWithCode() throws Exception {
        AuthService auth = mock(AuthService.class);
        OAuthHandoffService handoff = mock(OAuthHandoffService.class);

        UUID uid = UUID.randomUUID();
        UserEntity user = new UserEntity("g@example.com", null, "G");
        // id 는 생성자에서 무작위 — 테스트는 createCode 인자만 검증하지 않고 리다이렉트 URL 만 확인
        when(auth.oauthUpsert(eq("google"), eq("sub-1"), eq("g@example.com"), eq("G"))).thenReturn(user);
        when(handoff.createCode(user.getId().toString())).thenReturn("CODE123");

        OAuthSuccessHandler handler = new OAuthSuccessHandler(auth, handoff, "http://localhost:3000");

        DefaultOAuth2User principal = new DefaultOAuth2User(
            List.of(new SimpleGrantedAuthority("ROLE_USER")),
            Map.of("sub", "sub-1", "email", "g@example.com", "name", "G"),
            "sub");
        OAuth2AuthenticationToken token =
            new OAuth2AuthenticationToken(principal, principal.getAuthorities(), "google");

        MockHttpServletRequest req = new MockHttpServletRequest();
        MockHttpServletResponse res = new MockHttpServletResponse();
        handler.onAuthenticationSuccess(req, res, token);

        assertEquals("http://localhost:3000/auth/callback?code=CODE123", res.getRedirectedUrl());
    }
}
```

- [ ] **Step 3: 실패 확인**

Run: `./gradlew test --tests com.devjobs.auth.OAuthSuccessHandlerTest`
Expected: FAIL (`OAuthSuccessHandler` 없음)

- [ ] **Step 4: OAuthSuccessHandler 구현**

`src/main/java/com/devjobs/auth/OAuthSuccessHandler.java`:

```java
package com.devjobs.auth;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

/** OAuth 성공 -> 사용자 upsert -> 일회용 코드 -> web /auth/callback 리다이렉트. */
@Component
public class OAuthSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final AuthService auth;
    private final OAuthHandoffService handoff;
    private final String appBaseUrl;

    public OAuthSuccessHandler(AuthService auth,
                               OAuthHandoffService handoff,
                               @Value("${app.base-url}") String appBaseUrl) {
        this.auth = auth;
        this.handoff = handoff;
        this.appBaseUrl = appBaseUrl;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                        Authentication authentication) throws IOException, ServletException {
        OAuth2AuthenticationToken token = (OAuth2AuthenticationToken) authentication;
        String provider = token.getAuthorizedClientRegistrationId();
        OAuth2User u = token.getPrincipal();

        String sub;
        String email;
        String name;
        if ("github".equals(provider)) {
            Object id = u.getAttribute("id");
            sub = String.valueOf(id);
            email = u.getAttribute("email");
            name = u.getAttribute("name") != null ? u.getAttribute("name") : u.getAttribute("login");
        } else { // google (oidc)
            sub = u.getAttribute("sub");
            email = u.getAttribute("email");
            name = u.getAttribute("name");
        }

        UserEntity user = auth.oauthUpsert(provider, sub, email, name);
        String code = handoff.createCode(user.getId().toString());
        getRedirectStrategy().sendRedirect(request, response, appBaseUrl + "/auth/callback?code=" + code);
    }
}
```

- [ ] **Step 5: 통과 확인**

Run: `./gradlew test --tests com.devjobs.auth.OAuthSuccessHandlerTest`
Expected: PASS

- [ ] **Step 6: SecurityConfig 에 oauth2Login 배선**

`SecurityConfig` 에 필드 주입 + `oauth2Login` 추가. 생성자에 `CustomOAuth2UserService` 와 `OAuthSuccessHandler` 를 주입하고, `@Value("${app.base-url}") String appBaseUrl` 도 받는다.

import 추가:
```java
import com.devjobs.auth.CustomOAuth2UserService;
import com.devjobs.auth.OAuthSuccessHandler;
import org.springframework.beans.factory.annotation.Value;
```

필드/생성자 갱신:
```java
    private final JwtAuthFilter jwtAuthFilter;
    private final CustomOAuth2UserService oAuth2UserService;
    private final OAuthSuccessHandler oAuthSuccessHandler;
    private final String appBaseUrl;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter,
                          CustomOAuth2UserService oAuth2UserService,
                          OAuthSuccessHandler oAuthSuccessHandler,
                          @Value("${app.base-url}") String appBaseUrl) {
        this.jwtAuthFilter = jwtAuthFilter;
        this.oAuth2UserService = oAuth2UserService;
        this.oAuthSuccessHandler = oAuthSuccessHandler;
        this.appBaseUrl = appBaseUrl;
    }
```

`securityFilterChain` 의 `.addFilterBefore(...)` 바로 앞에 추가:
```java
            .oauth2Login(oauth -> oauth
                .userInfoEndpoint(ui -> ui.userService(oAuth2UserService))
                .successHandler(oAuthSuccessHandler)
                .failureUrl(appBaseUrl + "/signin?error=oauth")
            )
```

- [ ] **Step 7: 전체 백엔드 테스트 통과 확인**

Run: `./gradlew test`
Expected: PASS (전체). 컨텍스트 기동 시 oauth2Login 이 dummy 키로도 배선되어 정상 기동.

- [ ] **Step 8: 커밋**

```bash
git add backend/src/main/java/com/devjobs/auth/CustomOAuth2UserService.java backend/src/main/java/com/devjobs/auth/OAuthSuccessHandler.java backend/src/main/java/com/devjobs/config/SecurityConfig.java backend/src/test/java/com/devjobs/auth/OAuthSuccessHandlerTest.java
git commit -m "feat(auth): OAuth 로그인 (UserService+SuccessHandler) + oauth2Login 배선"
```

---

### Task 14: 수동 스모크 검증 (이메일 가입 경로)

코드 변경 없음 — 라이브 스택으로 흐름을 확인하고 결과를 기록한다.

**Files:** 없음

- [ ] **Step 1: 인프라 기동**

Run: `cd /Users/mac/WordDeveloper/WorldDeveloper && docker compose up -d postgres mailhog`
Expected: postgres(5433), mailhog(1025/8025) 기동.

- [ ] **Step 2: 백엔드 기동**

Run: `cd backend && ./gradlew bootRun`
Expected: 정상 기동(Flyway V6 적용 로그, 에러 없음).

- [ ] **Step 3: 가입 -> 메일 -> 검증 -> 로그인 스모크**

별도 터미널에서:
```bash
curl -s -X POST localhost:8080/api/v1/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"smoke@example.com","password":"password123","displayName":"Smoke"}' -i | head -1
```
Expected: `HTTP/1.1 200`

- Mailhog UI(`http://localhost:8025`)에서 수신 메일의 `/verify-email?token=...` 링크에서 token 복사.
```bash
curl -s -X POST localhost:8080/api/v1/auth/verify-email \
  -H 'content-type: application/json' -d '{"token":"<복사한 토큰>"}' -i | head -1
```
Expected: `HTTP/1.1 200`

```bash
curl -s -X POST localhost:8080/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"smoke@example.com","password":"password123"}'
```
Expected: `{"token":"<jwt>","user_id":"<uuid>","email":"smoke@example.com","display_name":"Smoke"}` (응답은 snake_case — `application.yml` 의 Jackson SNAKE_CASE 설정).

- [ ] **Step 4: 미인증 로그인 차단 확인**

```bash
curl -s -X POST localhost:8080/api/v1/auth/register -H 'content-type: application/json' \
  -d '{"email":"unv2@example.com","password":"password123","displayName":"U"}' >/dev/null
curl -s -X POST localhost:8080/api/v1/auth/login -H 'content-type: application/json' \
  -d '{"email":"unv2@example.com","password":"password123"}' -i | head -1
```
Expected: `HTTP/1.1 403`

- [ ] **Step 5: 결과 기록**

위 결과(특히 login 응답의 필드명이 snake_case 인지 — web 플랜이 이 계약에 의존)를 PR 설명 또는 검증 노트에 기록한다. 종료: `docker compose down` (또는 web 플랜으로 계속하려면 유지).

---

## Self-Review (작성자 점검 결과)

**Spec coverage:**
- 데이터 모델(스펙 §4) → Task 2 ✓
- JWT 발급(§3,§5.3) → Task 4 ✓ / `JwtAuthFilter` Bearer 검증은 기존 코드 유지(변경 없음)
- register/verify/resend/login(§5.3) → Task 6~9 ✓
- oauthUpsert 연결 로직(§5.3) → Task 11 ✓
- 일회용 코드(§3,§7) → Task 10 ✓
- 메일+로그 폴백(§5.3) → Task 5 ✓
- OAuth2 client + GitHub email + success handler(§5.4) → Task 13 ✓
- 컨트롤러 + 내부시크릿 exchange + permitAll(§5.5) → Task 12 ✓
- 레이트리밋(§5.3) → Task 12(컨트롤러) ✓
- 인프라/env/Mailhog(§9) → Task 1 ✓
- 테스트(§10) → 각 Task 의 테스트 + Task 14 수동 스모크 ✓

**Placeholder scan:** 없음. 모든 코드 블록은 컴파일 가능한 전체 본문.

**Type consistency:** `AuthResult(token,userId,email,displayName)` 는 login/exchange 공용. `oauthUpsert` 는 `UserEntity` 반환(handler/test 일치). `JwtService.issue(String)`, `OAuthHandoffService.createCode(String)/exchange(String)→AuthResult`, `TokenHasher.randomToken()/sha256Hex(String)` 시그니처가 전 Task 에서 일관.

**주의(후속):** GitHub `CustomOAuth2UserService` 의 실제 email 조회는 Task 14 수동 스모크에선 OAuth 키가 필요하므로 미검증 — OAuth 키 설정 시 web 플랜의 E2E 에서 확인. login/exchange 응답 JSON 은 `application.yml` Jackson 설정(SNAKE_CASE)에 따라 `user_id`/`display_name` 으로 직렬화됨 → web 플랜에서 이 필드명을 사용.
