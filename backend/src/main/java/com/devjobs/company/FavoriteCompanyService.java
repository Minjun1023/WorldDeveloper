package com.devjobs.company;

import com.devjobs.company.dto.CompanyDtos.CompanySummary;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class FavoriteCompanyService {

    private final FavoriteCompanyRepository repo;
    private final FavoriteCompanyAlertRepository alertRepo;
    private final CompanyService companyService;

    public FavoriteCompanyService(FavoriteCompanyRepository repo,
                                  FavoriteCompanyAlertRepository alertRepo,
                                  CompanyService companyService) {
        this.repo = repo;
        this.alertRepo = alertRepo;
        this.companyService = companyService;
    }

    /** 멱등 추가. 이미 있으면 created_at 보존(순서 유지)을 위해 재저장하지 않음. */
    public void add(UUID userId, String slug) {
        var key = new FavoriteCompanyEntity.Key(userId, slug);
        if (!repo.existsById(key)) {
            repo.save(new FavoriteCompanyEntity(userId, slug));
        }
        // 첫 관심기업 등록 시 알림 상태 자동 생성(기본 켬) — 워터마크는 지금부터라 과거 공고 스팸 없음.
        // 유저가 껐던(notify=false) 상태는 덮어쓰지 않는다.
        if (!alertRepo.existsById(userId)) {
            alertRepo.save(new FavoriteCompanyAlertEntity(userId));
        }
    }

    /** 멱등 삭제. 없으면 무시(EmptyResultDataAccessException 회피). */
    public void remove(UUID userId, String slug) {
        var key = new FavoriteCompanyEntity.Key(userId, slug);
        if (repo.existsById(key)) {
            repo.deleteById(key);
        }
    }

    /** 최신 즐겨찾기 순서로 회사 요약(이름·지역·공고수·태그) 반환. */
    public List<CompanySummary> list(UUID userId) {
        List<String> slugs = repo.findByUserIdOrderByCreatedAtDesc(userId).stream()
            .map(FavoriteCompanyEntity::getCompanySlug)
            .toList();
        return companyService.favorites(slugs);
    }
}
