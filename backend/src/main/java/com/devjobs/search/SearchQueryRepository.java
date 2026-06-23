package com.devjobs.search;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SearchQueryRepository extends JpaRepository<SearchQueryEntity, Long> {

    /** 검색자/일 기준 1회만 기록(중복은 무시). searched_on·created_at 은 기본값 사용. */
    @Modifying
    @Query(value = """
        INSERT INTO search_queries (term, searcher_key, user_id)
        VALUES (:term, :searcherKey, :userId)
        ON CONFLICT (term, searcher_key, searched_on) DO NOTHING
        """, nativeQuery = true)
    void record(@Param("term") String term, @Param("searcherKey") String searcherKey,
                @Param("userId") UUID userId);

    /**
     * 최근 N일 인기 검색어 상위: [term, count]. 최소 카운트(minCount) 이상만 노출해 1회성 잡음 제거.
     * 동률은 최근 검색이 많은 순(같은 카운트면 임의)이 아니라 term 알파벳순으로 안정 정렬.
     */
    @Query(value = "SELECT term, count(*) AS c FROM search_queries "
        + "WHERE created_at > now() - make_interval(days => :days) "
        + "GROUP BY term HAVING count(*) >= :minCount "
        + "ORDER BY c DESC, term ASC LIMIT :limit", nativeQuery = true)
    List<Object[]> topTermsSince(@Param("days") int days, @Param("minCount") int minCount,
                                 @Param("limit") int limit);
}
