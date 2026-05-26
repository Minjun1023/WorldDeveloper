package com.devjobs.scout;

import com.devjobs.domain.JobEntity;
import org.springframework.data.jpa.domain.Specification;

/** GET /api/v1/jobs 동적 필터. tags/salary 필터는 후속(native array 연산 필요). */
final class JobSpecifications {

    private JobSpecifications() {}

    static Specification<JobEntity> isActive() {
        return (root, query, cb) -> cb.isTrue(root.get("isActive"));
    }

    static Specification<JobEntity> visaStatus(String status) {
        return (root, query, cb) -> cb.equal(root.get("visaStatus"), status);
    }

    static Specification<JobEntity> location(String loc) {
        String like = "%" + loc.toLowerCase() + "%";
        return (root, query, cb) -> cb.like(cb.lower(root.get("location")), like);
    }

    static Specification<JobEntity> remote(boolean isRemote) {
        return (root, query, cb) -> cb.equal(root.get("isRemote"), isRemote);
    }
}
