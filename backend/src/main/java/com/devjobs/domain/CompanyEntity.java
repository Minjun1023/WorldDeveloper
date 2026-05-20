package com.devjobs.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.List;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "companies")
public class CompanyEntity {

    @Id
    private String slug;

    @Column(name = "display_name", nullable = false)
    private String displayName;

    private String ats;

    @Column(name = "ats_token")
    private String atsToken;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(columnDefinition = "text[]")
    private List<String> tags;

    @Column(name = "website_url")
    private String websiteUrl;

    @Column(name = "blog_rss_url")
    private String blogRssUrl;

    protected CompanyEntity() {}

    public String getSlug() { return slug; }
    public String getDisplayName() { return displayName; }
    public String getAts() { return ats; }
    public String getAtsToken() { return atsToken; }
    public List<String> getTags() { return tags; }
    public String getWebsiteUrl() { return websiteUrl; }
    public String getBlogRssUrl() { return blogRssUrl; }
}
