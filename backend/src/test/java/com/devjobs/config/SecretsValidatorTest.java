package com.devjobs.config;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class SecretsValidatorTest {

    private static final String DEFAULT_JWT = "dev-local-jwt-secret-change-me-min-32-bytes!!";
    private static final String DEFAULT_INTERNAL = "dev-internal-secret-change-me";
    private static final String DEFAULT_DB = "devjobs_local";
    private static final String STRONG_JWT = "a-strong-production-jwt-secret-of-32+bytes!!";

    private static SecretsValidator validator(boolean require, String jwt, String internal, String db) {
        return new SecretsValidator(require, jwt, internal, db);
    }

    @Test
    void disabledByDefaultAllowsDevDefaults() {
        assertThatCode(() -> validator(false, DEFAULT_JWT, DEFAULT_INTERNAL, DEFAULT_DB).validate())
            .doesNotThrowAnyException();
    }

    @Test
    void enabledRejectsDefaultJwt() {
        assertThatThrownBy(() -> validator(true, DEFAULT_JWT, "custom-internal", "custom-db").validate())
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("JWT_SECRET");
    }

    @Test
    void enabledRejectsDefaultInternalAndDb() {
        assertThatThrownBy(() -> validator(true, STRONG_JWT, DEFAULT_INTERNAL, DEFAULT_DB).validate())
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("INTERNAL_AUTH_SECRET")
            .hasMessageContaining("DATABASE_PASSWORD");
    }

    @Test
    void enabledRejectsShortJwt() {
        assertThatThrownBy(() -> validator(true, "too-short", "custom-internal", "custom-db").validate())
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("너무 짧");
    }

    @Test
    void enabledPassesWithStrongSecrets() {
        assertThatCode(() -> validator(true, STRONG_JWT, "custom-internal", "custom-db").validate())
            .doesNotThrowAnyException();
    }
}
