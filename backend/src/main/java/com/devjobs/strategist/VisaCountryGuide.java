package com.devjobs.strategist;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** visa_country_guides 행 — 국가별 사전합성 가이드 캐시(읽기 전용). */
@Entity
@Table(name = "visa_country_guides")
public class VisaCountryGuide {

    @Id
    @Column(name = "country")
    private String country;

    @Column(name = "guide_text", nullable = false)
    private String guideText;

    @Column(name = "sources", nullable = false)
    private String sources;          // JSON 배열 문자열

    @Column(name = "disclaimer", nullable = false)
    private String disclaimer;

    @Column(name = "generated_at")
    private Instant generatedAt;

    protected VisaCountryGuide() {}

    public String getCountry() { return country; }
    public String getGuideText() { return guideText; }
    public String getSources() { return sources; }
    public String getDisclaimer() { return disclaimer; }
    public Instant getGeneratedAt() { return generatedAt; }
}
