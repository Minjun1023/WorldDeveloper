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
