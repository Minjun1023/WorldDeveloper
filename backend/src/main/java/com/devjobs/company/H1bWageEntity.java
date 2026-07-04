package com.devjobs.company;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 미 노동부 LCA 공시 기반 회사별 H-1B 신고 연봉(소프트웨어 직군). ai/scripts/import_lca_wages.py 적재. */
@Entity
@Table(name = "company_h1b_wages")
public class H1bWageEntity {

    @Id @Column(name = "company_slug") private String companySlug;
    @Column private Integer cases;
    @Column(name = "median_wage") private Integer medianWage;
    @Column(name = "p25_wage") private Integer p25Wage;
    @Column(name = "p75_wage") private Integer p75Wage;
    @Column private String period;

    protected H1bWageEntity() {}

    public String getCompanySlug() { return companySlug; }
    public Integer getCases() { return cases; }
    public Integer getMedianWage() { return medianWage; }
    public Integer getP25Wage() { return p25Wage; }
    public Integer getP75Wage() { return p75Wage; }
    public String getPeriod() { return period; }
}
