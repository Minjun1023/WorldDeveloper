package com.devjobs.search;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/** 검색 실행 1건(검색자/일 기준). 기록은 native upsert, 집계는 native query 로 처리한다. */
@Entity
@Table(name = "search_queries")
public class SearchQueryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "term", nullable = false)
    private String term;

    @Column(name = "searcher_key", nullable = false)
    private String searcherKey;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "searched_on", nullable = false)
    private LocalDate searchedOn;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    protected SearchQueryEntity() {}

    public Long getId() { return id; }
    public String getTerm() { return term; }
    public String getSearcherKey() { return searcherKey; }
    public UUID getUserId() { return userId; }
    public LocalDate getSearchedOn() { return searchedOn; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
