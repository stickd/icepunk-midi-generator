package icepunk_backend.controller;

import icepunk_backend.dto.GeneratedPackResponse;
import icepunk_backend.dto.PresignedUrlResponse;
import icepunk_backend.dto.PublicGeneratedPackFeedResponse;
import icepunk_backend.dto.RenameGeneratedPackRequest;
import icepunk_backend.dto.UpdateGeneratedPackVisibilityRequest;
import icepunk_backend.service.GeneratedPackService.DownloadObject;
import icepunk_backend.model.User;
import icepunk_backend.repository.UserRepository;
import icepunk_backend.service.GeneratedPackService;
import icepunk_backend.service.GeneratedFileAccessService;
import jakarta.validation.Valid;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;
import java.util.UUID;

@RestController
public class GeneratedPackController {

    private final GeneratedPackService generatedPackService;
    private final UserRepository userRepository;
    private final GeneratedFileAccessService generatedFileAccessService;

    @Autowired
    public GeneratedPackController(
            GeneratedPackService generatedPackService,
            UserRepository userRepository,
            GeneratedFileAccessService generatedFileAccessService
    ) {
        this.generatedPackService = generatedPackService;
        this.userRepository = userRepository;
        this.generatedFileAccessService = generatedFileAccessService;
    }

    /** Retained for unit tests of legacy proxy endpoints. */
    public GeneratedPackController(GeneratedPackService generatedPackService, UserRepository userRepository) {
        this(generatedPackService, userRepository, null);
    }

    @GetMapping("/generated-packs/{packId}")
    public ResponseEntity<GeneratedPackResponse> getPack(Authentication authentication, @PathVariable UUID packId) {
        return generatedPackService.getPack(packId, viewerOrNull(authentication))
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/generated-packs/feed")
    public PublicGeneratedPackFeedResponse publicFeed(
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "10") int size
    ) {
        return generatedPackService.getPublicFeed(page, size);
    }

    @GetMapping("/users/{username}/generated-packs")
    public PublicGeneratedPackFeedResponse publicFeedByUsername(
            @PathVariable String username,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "10") int size
    ) {
        return generatedPackService.getPublicFeedByUsername(username, page, size);
    }

    @GetMapping("/generated-packs/{packId}/download")
    @Deprecated(since = "2026-07", forRemoval = false)
    public ResponseEntity<ByteArrayResource> downloadPack(Authentication authentication, @PathVariable UUID packId) {
        return generatedPackService.getPackDownload(packId, viewerOrNull(authentication))
                .map(download -> legacyDownloadResponse(download))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/generated-packs/{packId}/download-url")
    public ResponseEntity<PresignedUrlResponse> downloadPackUrl(Authentication authentication, @PathVariable UUID packId) {
        return signedUrl(() -> generatedFileAccessService.downloadPack(packId, viewerOrNull(authentication)));
    }

    @GetMapping("/generated-packs/{packId}/items/{itemId}/download")
    @Deprecated(since = "2026-07", forRemoval = false)
    public ResponseEntity<ByteArrayResource> downloadItem(
            Authentication authentication,
            @PathVariable UUID packId,
            @PathVariable UUID itemId
    ) {
        return generatedPackService.getItemDownload(packId, itemId, viewerOrNull(authentication))
                .map(download -> legacyDownloadResponse(download))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/generated-packs/{packId}/items/{itemId}/preview-url")
    public ResponseEntity<PresignedUrlResponse> previewItemUrl(
            Authentication authentication, @PathVariable UUID packId, @PathVariable UUID itemId
    ) {
        return signedUrl(() -> generatedFileAccessService.previewItem(packId, itemId, viewerOrNull(authentication)));
    }

    @GetMapping("/generated-packs/{packId}/items/{itemId}/download-url")
    public ResponseEntity<PresignedUrlResponse> downloadItemUrl(
            Authentication authentication, @PathVariable UUID packId, @PathVariable UUID itemId
    ) {
        return signedUrl(() -> generatedFileAccessService.downloadItem(packId, itemId, viewerOrNull(authentication)));
    }

    @GetMapping("/users/me/generated-packs")
    public List<GeneratedPackResponse> listMyPacks(Authentication authentication) {
        return generatedPackService.listPacksByOwner(currentUser(authentication));
    }

    @PatchMapping("/generated-packs/{packId}/name")
    public GeneratedPackResponse renamePack(
            Authentication authentication,
            @PathVariable UUID packId,
            @Valid @RequestBody RenameGeneratedPackRequest request
    ) {
        return generatedPackService.renamePack(packId, currentUser(authentication), request.name());
    }

    @PatchMapping("/generated-packs/{packId}/visibility")
    public GeneratedPackResponse updateVisibility(
            Authentication authentication,
            @PathVariable UUID packId,
            @Valid @RequestBody UpdateGeneratedPackVisibilityRequest request
    ) {
        return generatedPackService.updateVisibility(packId, currentUser(authentication), request.visibility());
    }

    @DeleteMapping("/generated-packs/{packId}")
    public ResponseEntity<Void> deletePack(Authentication authentication, @PathVariable UUID packId) {
        generatedPackService.deletePack(packId, currentUser(authentication));
        return ResponseEntity.noContent().build();
    }

    private User currentUser(Authentication authentication) {
        return userRepository.findByEmail(authentication.getName()).orElseThrow();
    }

    private User viewerOrNull(Authentication authentication) {
        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            return null;
        }

        return userRepository.findByEmail(authentication.getName()).orElse(null);
    }

    private ResponseEntity<ByteArrayResource> downloadResponse(DownloadObject download) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(download.contentType()))
                .contentLength(download.bytes().length)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + download.fileName() + "\"")
                .body(new ByteArrayResource(download.bytes()));
    }

    private ResponseEntity<ByteArrayResource> legacyDownloadResponse(DownloadObject download) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(download.contentType()))
                .contentLength(download.bytes().length)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + download.fileName() + "\"")
                .header("Deprecation", "true")
                .body(new ByteArrayResource(download.bytes()));
    }

    private ResponseEntity<PresignedUrlResponse> signedUrl(java.util.function.Supplier<PresignedUrlResponse> supplier) {
        try {
            return ResponseEntity.ok()
                    .header(HttpHeaders.CACHE_CONTROL, "no-store")
                    .header(HttpHeaders.PRAGMA, "no-cache")
                    .body(supplier.get());
        } catch (GeneratedFileAccessService.GeneratedFileNotFoundException exception) {
            return ResponseEntity.notFound().build();
        }
    }
}
