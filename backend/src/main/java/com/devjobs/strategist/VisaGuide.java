package com.devjobs.strategist;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;

/**
 * visa_guides 행. 리포지토리 부트스트랩용 최소 매핑 —
 * embedding(VECTOR) 컬럼은 Hibernate 가 모르는 타입이라 매핑하지 않고 네이티브 SQL 에서만 참조한다.
 * (ddl-auto=validate 는 매핑된 컬럼의 존재만 검증하므로 미매핑 컬럼은 무방.)
 */
@Entity
@Table(name = "visa_guides")
public class VisaGuide {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "country", nullable = false)
    private String country;

    @Column(name = "section", nullable = false)
    private String section;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "content", nullable = false)
    private String content;

    @Column(name = "source_url", nullable = false)
    private String sourceUrl;

    @Column(name = "retrieved_at", nullable = false)
    private LocalDate retrievedAt;

    protected VisaGuide() {}

    public Long getId() { return id; }
    public String getCountry() { return country; }
    public String getSection() { return section; }
    public String getTitle() { return title; }
    public String getContent() { return content; }
    public String getSourceUrl() { return sourceUrl; }
    public LocalDate getRetrievedAt() { return retrievedAt; }
}
