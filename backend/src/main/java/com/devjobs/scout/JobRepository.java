package com.devjobs.scout;

import com.devjobs.domain.JobEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

public interface JobRepository
    extends JpaRepository<JobEntity, String>, JpaSpecificationExecutor<JobEntity> {

    @Query(value = "SELECT visa_status, count(*) FROM jobs WHERE is_active = true GROUP BY visa_status",
        nativeQuery = true)
    List<Object[]> countByVisaStatus();

    @Query(value = "SELECT is_remote, count(*) FROM jobs WHERE is_active = true GROUP BY is_remote",
        nativeQuery = true)
    List<Object[]> countByRemote();
}
