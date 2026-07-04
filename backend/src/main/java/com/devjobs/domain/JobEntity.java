package com.devjobs.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.List;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "jobs")
public class JobEntity {

    @Id
    private String id;

    private String source;

    private String title;

    @Column(name = "company_slug", nullable = false)
    private String companySlug;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "company_slug", insertable = false, updatable = false)
    private CompanyEntity company;

    private String location;

    @Column(name = "is_remote")
    private Boolean isRemote;

    @Column(name = "employment_type")
    private String employmentType;

    /** 부서/팀 (greenhouse departments, lever team, SR function). 표시용. */
    private String department;

    /** 이주 지원 명시 여부 — 본문 정규식(job_meta.py). true=지원, false=거부, null=무언급. */
    @Column(name = "relocation_support")
    private Boolean relocationSupport;

    /** 어학 요건 — 'german' 등 현지어 요구 | 'english_only' | null. */
    @Column(name = "language_requirement")
    private String languageRequirement;

    private String description;

    @Column(name = "description_text")
    private String descriptionText;

    @Column(name = "apply_url")
    private String applyUrl;

    @Column(name = "posted_at")
    private OffsetDateTime postedAt;

    @Column(name = "closes_at")
    private OffsetDateTime closesAt;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(columnDefinition = "text[]")
    private List<String> tags;

    @Column(name = "salary_min_usd")
    private Integer salaryMinUsd;

    @Column(name = "salary_max_usd")
    private Integer salaryMaxUsd;

    @Column(name = "salary_min")
    private Long salaryMin;

    @Column(name = "salary_max")
    private Long salaryMax;

    @Column(name = "salary_currency")
    private String salaryCurrency;

    @Column(name = "salary_period")
    private String salaryPeriod;

    @Column(name = "experience_years")
    private Integer experienceYears;

    @Column(name = "seniority")
    private String seniority;

    @Column(name = "visa_status")
    private String visaStatus;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "visa_evidence", columnDefinition = "jsonb")
    private List<String> visaEvidence;

    @Column(name = "remote_eligibility")
    private String remoteEligibility;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "remote_evidence", columnDefinition = "jsonb")
    private List<String> remoteEvidence;

    @Column(name = "is_active")
    private Boolean isActive;

    // embedding(vector) 은 추천 전용 — 검색 Entity 에서 생략 (SELECT 제외)

    protected JobEntity() {}

    public String getId() { return id; }
    public String getSource() { return source; }
    public String getTitle() { return title; }
    public String getCompanySlug() { return companySlug; }
    public CompanyEntity getCompany() { return company; }
    public String getLocation() { return location; }
    public Boolean getIsRemote() { return isRemote; }
    public String getEmploymentType() { return employmentType; }
    public String getDepartment() { return department; }
    public Boolean getRelocationSupport() { return relocationSupport; }
    public String getLanguageRequirement() { return languageRequirement; }
    public String getDescription() { return description; }
    public String getDescriptionText() { return descriptionText; }
    public String getApplyUrl() { return applyUrl; }
    public OffsetDateTime getPostedAt() { return postedAt; }
    public OffsetDateTime getClosesAt() { return closesAt; }
    public List<String> getTags() { return tags; }
    public Integer getSalaryMinUsd() { return salaryMinUsd; }
    public Integer getSalaryMaxUsd() { return salaryMaxUsd; }
    public Long getSalaryMin() { return salaryMin; }
    public Long getSalaryMax() { return salaryMax; }
    public String getSalaryCurrency() { return salaryCurrency; }
    public String getSalaryPeriod() { return salaryPeriod; }
    public Integer getExperienceYears() { return experienceYears; }
    public String getSeniority() { return seniority; }
    public String getVisaStatus() { return visaStatus; }
    public List<String> getVisaEvidence() { return visaEvidence; }
    public String getRemoteEligibility() { return remoteEligibility; }
    public List<String> getRemoteEvidence() { return remoteEvidence; }
    public Boolean getIsActive() { return isActive; }
}
