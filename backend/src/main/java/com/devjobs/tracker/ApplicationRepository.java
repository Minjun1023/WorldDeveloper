package com.devjobs.tracker;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApplicationRepository
    extends JpaRepository<ApplicationEntity, ApplicationEntity.Key> {

    List<ApplicationEntity> findByUserIdOrderByUpdatedAtDesc(String userId);

    Optional<ApplicationEntity> findByUserIdAndJobId(String userId, String jobId);
}
