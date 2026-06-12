package com.devjobs.translate;

import com.devjobs.translate.TranslationService.TranslationUnavailableException;
import com.devjobs.translate.dto.TranslationDtos.TranslationDto;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 공고 번역 — 인증 불필요(공고 기반). 캐시 우선, 미스 시 AI 호출.
 * id 는 콜론 포함이라 {id:.+}.
 */
@RestController
@RequestMapping("/api/v1/jobs/{id:.+}")
public class TranslationController {

    private final TranslationService service;

    public TranslationController(TranslationService service) {
        this.service = service;
    }

    @GetMapping("/translation")
    public ResponseEntity<TranslationDto> translation(
        @PathVariable String id, @RequestParam(defaultValue = "ko") String lang,
        @RequestParam(defaultValue = "false") boolean cacheOnly) {
        try {
            // cacheOnly=true: 캐시된 번역만(AI 호출 안 함) — SSR 즉시표시. 미스는 404(클라가 번역 폴백).
            var result = cacheOnly ? service.getCached(id, lang) : service.getOrCreate(id, lang);
            return result
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
        } catch (TranslationUnavailableException e) {
            // 503: 번역 미설정/업스트림 오류 — 프론트가 '번역 사용 불가'로 안내
            return ResponseEntity.status(503).build();
        }
    }
}
