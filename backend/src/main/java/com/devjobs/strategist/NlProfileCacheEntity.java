package com.devjobs.strategist;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "nl_profile_cache")
public class NlProfileCacheEntity {

    @Id
    @Column(name = "input_hash", length = 64)
    private String inputHash;

    @Column(name = "profile_json", nullable = false)
    private String profileJson;

    @Column(name = "source", nullable = false)
    private String source;

    @Column(name = "created_at")
    private Instant createdAt;

    protected NlProfileCacheEntity() {}

    public NlProfileCacheEntity(String inputHash, String profileJson, String source) {
        this.inputHash = inputHash;
        this.profileJson = profileJson;
        this.source = source;
        this.createdAt = Instant.now();
    }

    public String getProfileJson() { return profileJson; }
    public String getSource() { return source; }
}
