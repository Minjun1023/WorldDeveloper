package com.devjobs.strategist;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class CountryResolverTest {

    @Test
    void resolvesSupportedCountriesFromLocation() {
        assertThat(CountryResolver.resolve("Berlin, Germany")).isEqualTo("de");
        assertThat(CountryResolver.resolve("London, UK")).isEqualTo("gb");
        assertThat(CountryResolver.resolve("Amsterdam")).isEqualTo("nl");
        assertThat(CountryResolver.resolve("Toronto, Canada")).isEqualTo("ca");
        assertThat(CountryResolver.resolve("San Francisco, CA")).isEqualTo("us");
    }

    @Test
    void returnsNullForUnknownOrAmbiguous() {
        assertThat(CountryResolver.resolve("Remote")).isNull();
        assertThat(CountryResolver.resolve("Tokyo, Japan")).isNull();
        assertThat(CountryResolver.resolve("Paris, France")).isNull();
        assertThat(CountryResolver.resolve("")).isNull();
        assertThat(CountryResolver.resolve(null)).isNull();
    }

    @Test
    void doesNotFalsePositiveUkSubstring() {
        // "Milwaukee" 는 "uk" 부분문자열을 포함하지만 gb 로 오인하면 안 된다.
        assertThat(CountryResolver.resolve("Milwaukee, WI")).isNotEqualTo("gb");
    }
}
