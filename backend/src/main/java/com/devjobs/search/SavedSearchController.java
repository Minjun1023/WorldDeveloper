package com.devjobs.search;

import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/me/searches")
public class SavedSearchController {

    public record CreateReq(String label, SavedSearchParams params) {}

    private final SavedSearchService service;
    public SavedSearchController(SavedSearchService service) { this.service = service; }
    private UUID uid(String userId) { return UUID.fromString(userId); }

    @GetMapping
    public List<SavedSearchService.SavedSearchView> list(@AuthenticationPrincipal String userId) {
        return service.list(uid(userId));
    }

    @PostMapping
    public ResponseEntity<SavedSearchService.SavedSearchView> create(
            @AuthenticationPrincipal String userId, @RequestBody CreateReq req) {
        SavedSearchParams params = req.params() != null ? req.params()
            : new SavedSearchParams(null, null, null, null, null, null, null, null, false);
        var e = service.create(uid(userId), req.label(), params);
        return ResponseEntity.ok(new SavedSearchService.SavedSearchView(
            e.getId(), e.getLabel(), e.getParams(), 0, e.getLastSeenAt()));
    }

    @PostMapping("/{id}/seen")
    public ResponseEntity<Void> seen(@AuthenticationPrincipal String userId, @PathVariable UUID id) {
        service.markSeen(uid(userId), id);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal String userId, @PathVariable UUID id) {
        service.delete(uid(userId), id);
        return ResponseEntity.ok().build();
    }
}
