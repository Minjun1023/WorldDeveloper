package com.devjobs.scout;

import com.devjobs.scout.dto.JobDtos.JobDetailDto;
import com.devjobs.scout.dto.JobDtos.JobListResponse;
import com.devjobs.scout.dto.JobDtos.RegionCount;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/jobs")
public class JobController {

    private final JobService service;

    public JobController(JobService service) {
        this.service = service;
    }

    @GetMapping
    public JobListResponse list(
        @RequestParam(required = false) String q,
        @RequestParam(required = false) String visa,
        @RequestParam(required = false) String location,
        @RequestParam(required = false) Boolean remote,
        @RequestParam(required = false) String sort,
        @RequestParam(required = false) String discipline,
        @RequestParam(required = false) String region,
        @RequestParam(required = false) String track,
        @RequestParam(name = "include_unclear", defaultValue = "false") boolean includeUnclear,
        @RequestParam(name = "verified_only", defaultValue = "false") boolean verifiedOnly,
        @RequestParam(name = "min_salary", required = false) Integer minSalary,
        @RequestParam(defaultValue = "false") boolean complete,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(name = "page_size", defaultValue = "20") int pageSize) {
        return service.search(q, visa, location, remote, sort, discipline, region,
            track, includeUnclear, verifiedOnly, minSalary, complete, page, pageSize);
    }

    @GetMapping("/regions")
    public List<RegionCount> regions() {
        return service.regionCounts();
    }

    // 최근 스크랩(수집) 공고 피드 (viable·first_seen_at 내림차순). "/recent" 는 "/{id:.+}" 보다
    // 구체적 매핑이라 id 패턴보다 우선 라우팅된다.
    @GetMapping("/recent")
    public JobListResponse recent(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(name = "page_size", defaultValue = "20") int pageSize) {
        return service.recentScraped(page, pageSize);
    }

    // id 는 콜론 포함 ("greenhouse:stripe:7737237") — {id:.+} 로 전체 segment 매칭
    @GetMapping("/{id:.+}")
    public ResponseEntity<JobDetailDto> getOne(@PathVariable String id) {
        return service.findById(id)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
