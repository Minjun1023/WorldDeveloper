package com.devjobs.profile;

import com.devjobs.profile.dto.ProfileDto;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/me/profile")
public class ProfileController {

    private final ProfileService service;

    public ProfileController(ProfileService service) {
        this.service = service;
    }

    @GetMapping
    public ProfileDto.ProfileResponse get(@AuthenticationPrincipal String userId) {
        return service.get(UUID.fromString(userId));
    }

    @PutMapping
    public ProfileDto.ProfileResponse put(@AuthenticationPrincipal String userId,
                                          @RequestBody ProfileDto.Profile body) {
        UUID id = UUID.fromString(userId);
        service.upsert(id, body);
        return service.get(id);
    }
}
