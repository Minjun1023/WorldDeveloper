package com.devjobs.feedback.dto;

import java.util.List;
import java.util.Map;

public class FeedbackDtos {
    public record ReactionRequest(String reaction) {}
    public record FeedbackEvent(String job_id, String action, Integer rank, Float score) {}
    public record FeedbackBatch(List<FeedbackEvent> events) {}
    public record Interactions(List<String> saved, Map<String, String> reactions) {}
}
