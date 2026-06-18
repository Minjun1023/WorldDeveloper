package com.devjobs.community;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CommunityReportRepository extends JpaRepository<CommunityReport, UUID> {

    // 같은 신고자가 같은 대상을 또 신고했는지(중복 방지) + 대상의 누적 신고 수(자동 숨김 임계치 판정).
    boolean existsByTargetIdAndReporterId(UUID targetId, UUID reporterId);

    long countByTargetId(UUID targetId);
}
