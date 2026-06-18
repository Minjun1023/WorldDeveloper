package com.devjobs.community;

import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CommunityPostRepository extends JpaRepository<CommunityPost, UUID> {

    // 공개 글 목록 — 선택 필터(카테고리/회사/국가/공고/검색어/미답변). 정렬은 Pageable 의 Sort.
    @Query("select p from CommunityPost p where p.status = 'published' "
        + "and (:category is null or p.category = :category) "
        + "and (:company is null or p.linkedCompanySlug = :company) "
        + "and (:country is null or p.linkedCountry = :country) "
        + "and (:jobId is null or p.linkedJobId = :jobId) "
        + "and (lower(p.title) like lower(concat('%', :q, '%')) "
        + "       or lower(p.body) like lower(concat('%', :q, '%'))) "
        + "and (:unanswered = false or p.commentCount = 0)")
    List<CommunityPost> search(@Param("category") String category,
                               @Param("company") String company,
                               @Param("country") String country,
                               @Param("jobId") String jobId,
                               @Param("q") String q,
                               @Param("unanswered") boolean unanswered,
                               Pageable pageable);
}
