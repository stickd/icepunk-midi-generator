package icepunk_backend.controller;

import icepunk_backend.dto.LikeResponse;
import icepunk_backend.dto.MeResponse;
import icepunk_backend.dto.UpdateProfileRequest;
import icepunk_backend.dto.UserPackListResponse;
import icepunk_backend.dto.UserProfileResponse;
import icepunk_backend.service.UserProfileService;
import jakarta.validation.Valid;
import java.io.IOException;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
public class UserProfileController {

    private final UserProfileService userProfileService;

    public UserProfileController(UserProfileService userProfileService) {
        this.userProfileService = userProfileService;
    }

    @GetMapping("/users/{username}/profile")
    public UserProfileResponse profile(@PathVariable("username") String username) {
        return userProfileService.getProfile(username);
    }

    @GetMapping("/users/{userId}/avatar")
    public ResponseEntity<byte[]> avatar(@PathVariable("userId") Long userId) {
        UserProfileService.AvatarFile avatar = userProfileService.getAvatar(userId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(avatar.contentType()))
                .body(avatar.bytes());
    }

    @GetMapping("/users/{username}/packs")
    public UserPackListResponse packs(
            @PathVariable("username") String username,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "12") int size,
            Authentication authentication
    ) {
        String viewerEmail = authentication == null ? null : authentication.getName();
        return userProfileService.getUserPacks(username, page, size, viewerEmail);
    }

    @GetMapping("/users/me")
    public MeResponse me(Authentication authentication) {
        return userProfileService.getMe(authentication.getName());
    }

    @PostMapping("/users/me/profile")
    public MeResponse updateProfile(
            Authentication authentication,
            @Valid @RequestBody UpdateProfileRequest request
    ) {
        return userProfileService.updateProfile(authentication.getName(), request.bio(), request.profilePictureUrl());
    }

    @PostMapping("/users/me/avatar")
    public MeResponse updateAvatar(
            Authentication authentication,
            @RequestParam("file") MultipartFile file
    ) throws IOException {
        return userProfileService.updateAvatar(authentication.getName(), file);
    }

    @GetMapping("/users/me/favorites")
    public UserPackListResponse favorites(
            Authentication authentication,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "12") int size
    ) {
        return userProfileService.getFavorites(authentication.getName(), page, size);
    }

    @PostMapping("/uploads/projects/{id}/like")
    public LikeResponse like(Authentication authentication, @PathVariable("id") Long id) {
        return userProfileService.like(authentication.getName(), id);
    }

    @DeleteMapping("/uploads/projects/{id}/like")
    public LikeResponse unlike(Authentication authentication, @PathVariable("id") Long id) {
        return userProfileService.unlike(authentication.getName(), id);
    }
}
