package com.devjobs.auth;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class PasswordPolicyTest {

    @Test
    void validPasswordPasses() {
        assertDoesNotThrow(() -> PasswordPolicy.validate("Password123"));
    }

    @Test
    void tooShortRejected() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
            () -> PasswordPolicy.validate("Pass123")); // 7자
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().contains("too_short"));
    }

    @Test
    void tooLongRejected() {
        String longPw = "Aa1" + "x".repeat(70); // 73 ASCII 바이트
        assertTrue(assertThrows(ResponseStatusException.class,
            () -> PasswordPolicy.validate(longPw)).getReason().contains("too_long"));
    }

    @Test
    void missingUppercaseRejected() {
        assertTrue(assertThrows(ResponseStatusException.class,
            () -> PasswordPolicy.validate("password123")).getReason().contains("need_uppercase"));
    }

    @Test
    void missingLowercaseRejected() {
        assertTrue(assertThrows(ResponseStatusException.class,
            () -> PasswordPolicy.validate("PASSWORD123")).getReason().contains("need_lowercase"));
    }

    @Test
    void missingDigitRejected() {
        assertTrue(assertThrows(ResponseStatusException.class,
            () -> PasswordPolicy.validate("PasswordAbc")).getReason().contains("need_digit"));
    }

    @Test
    void nullRejected() {
        assertTrue(assertThrows(ResponseStatusException.class,
            () -> PasswordPolicy.validate(null)).getReason().contains("too_short"));
    }
}
