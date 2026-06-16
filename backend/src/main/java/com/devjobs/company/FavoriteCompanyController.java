package com.devjobs.company;

import com.devjobs.company.dto.CompanyDtos.CompanySummary;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/me/favorite-companies")
public class FavoriteCompanyController {

    private final FavoriteCompanyService service;

    public FavoriteCompanyController(FavoriteCompanyService service) {
        this.service = service;
    }

    private UUID uid(String userId) { return UUID.fromString(userId); }

    @GetMapping
    public List<CompanySummary> list(@AuthenticationPrincipal String userId) {
        return service.list(uid(userId));
    }

    @PutMapping("/{slug}")
    public ResponseEntity<Void> add(@AuthenticationPrincipal String userId, @PathVariable String slug) {
        service.add(uid(userId), slug);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{slug}")
    public ResponseEntity<Void> remove(@AuthenticationPrincipal String userId, @PathVariable String slug) {
        service.remove(uid(userId), slug);
        return ResponseEntity.ok().build();
    }
}
