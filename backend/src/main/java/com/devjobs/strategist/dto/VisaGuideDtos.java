package com.devjobs.strategist.dto;

import java.util.List;

public final class VisaGuideDtos {
    private VisaGuideDtos() {}

    public record SourceRef(String title, String url, String retrievedAt) {}

    public record VisaGuideResponse(String text, List<SourceRef> sources, String disclaimer) {}
}
