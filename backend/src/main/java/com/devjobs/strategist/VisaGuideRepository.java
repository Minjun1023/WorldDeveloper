package com.devjobs.strategist;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface VisaGuideRepository extends JpaRepository<VisaGuide, Long> {

    /**
     * 국가 필터 + 쿼리 임베딩 cosine 유사도 상위 K 청크 회수 (pgvector).
     * 반환 행: [content, source_url, retrieved_at('YYYY-MM-DD'), section, title]
     * retrieved_at 은 to_char 로 문자열화 — java.sql.Date 캐스팅 회피.
     */
    @Query(value = """
        SELECT content, source_url, to_char(retrieved_at, 'YYYY-MM-DD') AS retrieved_at, section, title
        FROM visa_guides
        WHERE country = :country
        ORDER BY embedding <=> CAST(:vec AS vector)
        LIMIT :lim
        """, nativeQuery = true)
    List<Object[]> findByCountrySemantic(@Param("country") String country,
                                         @Param("vec") String vec,
                                         @Param("lim") int lim);
}
