package com.devjobs.translate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.devjobs.domain.JobTranslationEntity;
import com.devjobs.scout.JobRepository;
import com.devjobs.strategist.AiClient;
import com.devjobs.translate.dto.TranslationDtos.TranslationDto;
import java.util.Optional;
import org.junit.jupiter.api.Test;

/** getCached 는 캐시만 보고 AI 를 호출하지 않는다(SSR 즉시표시용). */
class TranslationServiceCacheTest {

    private final TranslationRepository repo = mock(TranslationRepository.class);
    private final JobRepository jobRepo = mock(JobRepository.class);
    private final AiClient ai = mock(AiClient.class);
    private final TranslationService service = new TranslationService(repo, jobRepo, ai);

    @Test
    void getCachedReturnsCachedWithoutCallingAi() {
        when(repo.findByJobIdAndLang("j:1", "ko"))
            .thenReturn(Optional.of(new JobTranslationEntity("j:1", "ko", "제목", "본문", "libre")));

        Optional<TranslationDto> out = service.getCached("j:1", "ko");

        assertTrue(out.isPresent());
        assertEquals("본문", out.get().description());
        assertTrue(out.get().cached());
        verify(ai, never()).translate(anyString(), anyString(), anyString());
    }

    @Test
    void getCachedMissReturnsEmptyAndNeverTranslates() {
        when(repo.findByJobIdAndLang(anyString(), anyString())).thenReturn(Optional.empty());

        assertTrue(service.getCached("nope", "ko").isEmpty());
        verify(ai, never()).translate(any(), any(), any());
    }
}
