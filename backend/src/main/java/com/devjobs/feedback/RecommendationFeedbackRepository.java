package com.devjobs.feedback;

import org.springframework.data.jpa.repository.JpaRepository;

public interface RecommendationFeedbackRepository extends JpaRepository<RecommendationFeedbackEntity, Long> {
}
