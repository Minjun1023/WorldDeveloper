package com.devjobs.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "user_identities")
public class UserIdentityEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "provider", nullable = false)
    private String provider;

    @Column(name = "provider_sub", nullable = false)
    private String providerSub;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    protected UserIdentityEntity() {}

    public UserIdentityEntity(UUID userId, String provider, String providerSub) {
        this.userId = userId;
        this.provider = provider;
        this.providerSub = providerSub;
        this.createdAt = OffsetDateTime.now();
    }

    public Long getId() { return id; }
    public UUID getUserId() { return userId; }
    public String getProvider() { return provider; }
    public String getProviderSub() { return providerSub; }
}
