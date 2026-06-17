package com.devjobs.community;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CommunityReportRepository extends JpaRepository<CommunityReport, UUID> {}
