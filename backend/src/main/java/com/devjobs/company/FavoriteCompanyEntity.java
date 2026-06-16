package com.devjobs.company;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "favorite_companies")
@IdClass(FavoriteCompanyEntity.Key.class)
public class FavoriteCompanyEntity {
    public static class Key implements Serializable {
        public UUID userId;
        public String companySlug;
        public Key() {}
        public Key(UUID userId, String companySlug) { this.userId = userId; this.companySlug = companySlug; }
        @Override public boolean equals(Object o) {
            if (!(o instanceof Key k)) return false;
            return userId.equals(k.userId) && companySlug.equals(k.companySlug);
        }
        @Override public int hashCode() { return userId.hashCode() * 31 + companySlug.hashCode(); }
    }

    @Id @Column(name = "user_id") private UUID userId;
    @Id @Column(name = "company_slug") private String companySlug;
    @Column(name = "created_at") private OffsetDateTime createdAt;

    protected FavoriteCompanyEntity() {}
    public FavoriteCompanyEntity(UUID userId, String companySlug) {
        this.userId = userId; this.companySlug = companySlug; this.createdAt = OffsetDateTime.now();
    }
    public UUID getUserId() { return userId; }
    public String getCompanySlug() { return companySlug; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
