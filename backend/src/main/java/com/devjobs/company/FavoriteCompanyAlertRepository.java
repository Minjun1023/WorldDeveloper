package com.devjobs.company;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FavoriteCompanyAlertRepository extends JpaRepository<FavoriteCompanyAlertEntity, UUID> {
    List<FavoriteCompanyAlertEntity> findByNotifyTrue();
    Optional<FavoriteCompanyAlertEntity> findByUnsubscribeToken(UUID token);
}
