package com.devjobs.profile;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "user_profiles")
public class UserProfileEntity {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(columnDefinition = "text[]")
    private List<String> skills = new ArrayList<>();

    @Column
    private String seniority;

    @Column(name = "years_experience")
    private Integer yearsExperience;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "preferred_locations", columnDefinition = "text[]")
    private List<String> preferredLocations = new ArrayList<>();

    @Column(name = "remote_preference")
    private String remotePreference;

    @Column(name = "desired_salary_usd")
    private Integer desiredSalaryUsd;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    protected UserProfileEntity() {}

    public UserProfileEntity(UUID userId) {
        this.userId = userId;
    }

    public UUID getUserId() { return userId; }
    public List<String> getSkills() { return skills == null ? List.of() : skills; }
    public void setSkills(List<String> v) { this.skills = v; }
    public String getSeniority() { return seniority; }
    public void setSeniority(String v) { this.seniority = v; }
    public Integer getYearsExperience() { return yearsExperience; }
    public void setYearsExperience(Integer v) { this.yearsExperience = v; }
    public List<String> getPreferredLocations() { return preferredLocations == null ? List.of() : preferredLocations; }
    public void setPreferredLocations(List<String> v) { this.preferredLocations = v; }
    public String getRemotePreference() { return remotePreference; }
    public void setRemotePreference(String v) { this.remotePreference = v; }
    public Integer getDesiredSalaryUsd() { return desiredSalaryUsd; }
    public void setDesiredSalaryUsd(Integer v) { this.desiredSalaryUsd = v; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime v) { this.updatedAt = v; }
}
