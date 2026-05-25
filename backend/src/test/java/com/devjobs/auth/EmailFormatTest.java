package com.devjobs.auth;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class EmailFormatTest {
    @Test void validEmails() {
        assertTrue(EmailFormat.isValid("a@b.com"));
        assertTrue(EmailFormat.isValid("user.name+tag@sub.example.co.kr"));
    }
    @Test void invalidEmails() {
        assertFalse(EmailFormat.isValid(null));
        assertFalse(EmailFormat.isValid(""));
        assertFalse(EmailFormat.isValid("no-at"));
        assertFalse(EmailFormat.isValid("a@b"));            // 도메인 점 없음
        assertFalse(EmailFormat.isValid("a b@c.com"));      // 공백
        assertFalse(EmailFormat.isValid("a@@b.com"));
    }
}
