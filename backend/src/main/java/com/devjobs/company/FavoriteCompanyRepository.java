package com.devjobs.company;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FavoriteCompanyRepository
    extends JpaRepository<FavoriteCompanyEntity, FavoriteCompanyEntity.Key> {
    List<FavoriteCompanyEntity> findByUserIdOrderByCreatedAtDesc(UUID userId);
}
