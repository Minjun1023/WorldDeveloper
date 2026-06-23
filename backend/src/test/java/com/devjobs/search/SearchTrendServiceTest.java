package com.devjobs.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

class SearchTrendServiceTest {

    @Test
    void normalizeTrimsLowercasesAndCollapsesSpaces() {
        assertEquals("react berlin", SearchTrendService.normalize("  React   Berlin "));
        assertEquals("백엔드", SearchTrendService.normalize("백엔드"));
        assertEquals("go 1.21", SearchTrendService.normalize("Go 1.21"));
    }

    @Test
    void normalizeRejectsTooShortBlankOrSymbolOnly() {
        assertNull(SearchTrendService.normalize(null));
        assertNull(SearchTrendService.normalize(""));
        assertNull(SearchTrendService.normalize("   "));
        assertNull(SearchTrendService.normalize("a")); // 1글자
        assertNull(SearchTrendService.normalize("!!!")); // 글자/숫자 없음
    }

    @Test
    void normalizeRejectsTooLong() {
        assertNull(SearchTrendService.normalize("a".repeat(41)));
        assertEquals("a".repeat(40), SearchTrendService.normalize("a".repeat(40)));
    }
}
