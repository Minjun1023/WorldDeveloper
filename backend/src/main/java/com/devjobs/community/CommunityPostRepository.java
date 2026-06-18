package com.devjobs.community;

import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CommunityPostRepository extends JpaRepository<CommunityPost, UUID> {

    // 공개 글 목록 — 선택 필터(카테고리/회사/국가/공고/태그/검색어/미답변). 정렬은 Pageable 의 Sort.
    @Query("select p from CommunityPost p where p.status = 'published' "
        + "and (:category is null or p.category = :category) "
        + "and (:company is null or p.linkedCompanySlug = :company) "
        + "and (:country is null or p.linkedCountry = :country) "
        + "and (:jobId is null or p.linkedJobId = :jobId) "
        + "and (:tag is null or :tag member of p.tags) "
        + "and (lower(p.title) like lower(concat('%', :q, '%')) "
        + "       or lower(p.body) like lower(concat('%', :q, '%'))) "
        + "and (:unanswered = false or p.commentCount = 0)")
    List<CommunityPost> search(@Param("category") String category,
                               @Param("company") String company,
                               @Param("country") String country,
                               @Param("jobId") String jobId,
                               @Param("tag") String tag,
                               @Param("q") String q,
                               @Param("unanswered") boolean unanswered,
                               Pageable pageable);

    // --- facet 집계(공개 글 전체 기준) ---
    @Query("select p.category, count(p) from CommunityPost p where p.status = 'published' group by p.category")
    List<Object[]> countByCategory();

    @Query("select p.linkedCountry, count(p) from CommunityPost p "
        + "where p.status = 'published' and p.linkedCountry is not null group by p.linkedCountry")
    List<Object[]> countByCountry();

    @Query("select t, count(t) from CommunityPost p join p.tags t "
        + "where p.status = 'published' group by t order by count(t) desc, t asc")
    List<Object[]> countByTag(Pageable pageable);

    // --- 조회수: 고유 열람자당 1회. 신규 삽입(영향 1행)일 때만 카운트 증가. ---
    @Modifying
    @Query(value = "insert into community_post_views(post_id, viewer_key) values (:pid, :vk) "
        + "on conflict do nothing", nativeQuery = true)
    int recordView(@Param("pid") UUID pid, @Param("vk") String viewerKey);

    @Modifying
    @Query(value = "update community_posts set view_count = view_count + 1 where id = :pid", nativeQuery = true)
    void incrementViewCount(@Param("pid") UUID pid);
}
