package com.devjobs.scout;

import com.devjobs.scout.dto.JobDtos.JobDetailDto;
import com.devjobs.scout.dto.JobDtos.JobListResponse;
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
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(name = "page_size", defaultValue = "20") int pageSize) {
        return service.search(q, visa, location, remote, sort, page, pageSize);
    }

    // id 는 콜론 포함 ("greenhouse:stripe:7737237") — {id:.+} 로 전체 segment 매칭
    @GetMapping("/{id:.+}")
    public ResponseEntity<JobDetailDto> getOne(@PathVariable String id) {
        return service.findById(id)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
