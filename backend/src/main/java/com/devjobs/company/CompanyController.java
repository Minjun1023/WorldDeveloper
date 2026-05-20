package com.devjobs.company;

import com.devjobs.company.dto.CompanyDtos.CompanyDetail;
import com.devjobs.company.dto.CompanyDtos.CompanyListResponse;
import com.devjobs.scout.JobService;
import com.devjobs.scout.dto.JobDtos.JobDto;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/companies")
public class CompanyController {

    private final CompanyService companyService;
    private final JobService jobService;

    public CompanyController(CompanyService companyService, JobService jobService) {
        this.companyService = companyService;
        this.jobService = jobService;
    }

    @GetMapping
    public CompanyListResponse list(@RequestParam(required = false) String tag) {
        return companyService.list(tag);
    }

    @GetMapping("/{slug}")
    public ResponseEntity<CompanyDetail> detail(@PathVariable String slug) {
        return companyService.detail(slug)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/{slug}/jobs")
    public List<JobDto> jobs(@PathVariable String slug) {
        return jobService.listByCompany(slug);
    }
}
