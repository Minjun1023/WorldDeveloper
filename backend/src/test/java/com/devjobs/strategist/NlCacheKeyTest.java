package com.devjobs.strategist;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import org.junit.jupiter.api.Test;

class NlCacheKeyTest {

    @Test
    void normalizeLowercasesAndCollapsesWhitespace() {
        assertEquals("go python", NlCacheKey.normalize("  Go   Python "));
    }

    @Test
    void sameNormalizedInputSameHash() {
        assertEquals(NlCacheKey.hash("Go Python"), NlCacheKey.hash("  go   python "));
    }

    @Test
    void differentInputDifferentHash_andLength64() {
        assertNotEquals(NlCacheKey.hash("Go"), NlCacheKey.hash("Python"));
        assertEquals(64, NlCacheKey.hash("Go").length());
    }
}
