package com.devjobs.config;

import jakarta.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 운영 시크릿 fail-fast 검증.
 *
 * <p>{@code app.require-secure-secrets=true}(운영 배포에서만 설정)일 때, JWT/내부/DB 시크릿이
 * 소스에 박힌 dev 기본값 그대로면 부팅을 거부한다. env 미설정 시 dev 기본값으로 폴백해
 * <b>JWT 위조·인증 우회</b>가 가능했던 문제를 운영에서 차단한다.
 *
 * <p>기본값(false)이면 검증을 건너뛰어 로컬/CI/테스트는 그대로 동작한다.
 */
@Component
public class SecretsValidator {

    private static final Logger log = LoggerFactory.getLogger(SecretsValidator.class);

    // application.yml 에 박힌 dev 기본값들 — 운영에서 이 값이면 거부.
    private static final String DEFAULT_JWT = "dev-local-jwt-secret-change-me-min-32-bytes!!";
    private static final String DEFAULT_INTERNAL = "dev-internal-secret-change-me";
    private static final String DEFAULT_DB_PASSWORD = "devjobs_local";
    private static final int MIN_JWT_BYTES = 32;  // HS256 최소 키 길이

    private final boolean require;
    private final String jwtSecret;
    private final String internalSecret;
    private final String dbPassword;

    public SecretsValidator(
            @Value("${app.require-secure-secrets:false}") boolean require,
            @Value("${jwt.secret}") String jwtSecret,
            @Value("${auth.internal-secret}") String internalSecret,
            @Value("${spring.datasource.password}") String dbPassword) {
        this.require = require;
        this.jwtSecret = jwtSecret;
        this.internalSecret = internalSecret;
        this.dbPassword = dbPassword;
    }

    @PostConstruct
    void validate() {
        if (!require) {
            log.info("secret validation skipped (app.require-secure-secrets=false)");
            return;
        }
        List<String> violations = new ArrayList<>();
        if (DEFAULT_JWT.equals(jwtSecret)) {
            violations.add("JWT_SECRET 가 dev 기본값입니다");
        } else if (jwtSecret == null
                || jwtSecret.getBytes(StandardCharsets.UTF_8).length < MIN_JWT_BYTES) {
            violations.add("JWT_SECRET 가 너무 짧습니다(최소 " + MIN_JWT_BYTES + "바이트)");
        }
        if (DEFAULT_INTERNAL.equals(internalSecret)) {
            violations.add("INTERNAL_AUTH_SECRET 가 dev 기본값입니다");
        }
        if (DEFAULT_DB_PASSWORD.equals(dbPassword)) {
            violations.add("DATABASE_PASSWORD 가 dev 기본값입니다");
        }
        if (!violations.isEmpty()) {
            throw new IllegalStateException(
                "운영 시크릿 검증 실패 — env 로 교체하세요: " + String.join(", ", violations));
        }
        log.info("secret validation passed (운영 시크릿이 dev 기본값과 다름)");
    }
}
