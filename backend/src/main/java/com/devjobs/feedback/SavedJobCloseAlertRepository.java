package com.devjobs.feedback;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SavedJobCloseAlertRepository extends JpaRepository<SavedJobCloseAlertEntity, UUID> {
    List<SavedJobCloseAlertEntity> findByNotifyTrue();
    Optional<SavedJobCloseAlertEntity> findByUnsubscribeToken(UUID token);
}
