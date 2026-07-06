package com.devjobs.profile;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProfileMatchAlertRepository extends JpaRepository<ProfileMatchAlertEntity, UUID> {
    List<ProfileMatchAlertEntity> findByNotifyTrue();
    Optional<ProfileMatchAlertEntity> findByUnsubscribeToken(UUID token);
}
