package com.devjobs.popular;

import com.devjobs.popular.PopularJobDtos.PopularJob;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 인기 공고(홈 랜딩). 공개 — 비로그인도 조회. region/function 은 선택. */
@RestController
@RequestMapping("/api/v1/popular-jobs")
public class PopularJobController {

    private final PopularJobService svc;

    public PopularJobController(PopularJobService svc) {
        this.svc = svc;
    }

    @GetMapping
    public List<PopularJob> popular(@RequestParam(required = false) String region,
                                    @RequestParam(name = "discipline", required = false) String discipline,
                                    @RequestParam(defaultValue = "6") int limit) {
        return svc.popular(region, discipline, Math.min(Math.max(limit, 1), 24));
    }
}
