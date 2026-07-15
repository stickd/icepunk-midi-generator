package icepunk_backend.controller;

import icepunk_backend.dto.PublicUploadFeedResponse;
import icepunk_backend.dto.UserUploadResponse;
import icepunk_backend.model.User;
import icepunk_backend.repository.UserRepository;
import icepunk_backend.service.UserUploadService;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
public class UserUploadController {

    private final UserUploadService userUploadService;
    private final UserRepository userRepository;

    public UserUploadController(UserUploadService userUploadService, UserRepository userRepository) {
        this.userUploadService = userUploadService;
        this.userRepository = userRepository;
    }

    @GetMapping("/uploads/feed")
    public PublicUploadFeedResponse publicFeed(
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "10") int size
    ) {
        return userUploadService.getPublicFeed(page, size);
    }

    @GetMapping("/uploads/projects/{id}/midi")
    public ResponseEntity<byte[]> projectMidi(Authentication authentication, @PathVariable("id") Long id) {
        return userUploadService.getMidiFile(id, viewerOrNull(authentication))
                .map(file -> ResponseEntity.ok()
                        .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + file.filename() + "\"")
                        .contentType(MediaType.parseMediaType(file.contentType()))
                        .body(file.bytes()))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/uploads/projects")
    public ResponseEntity<UserUploadResponse> uploadProject(
            Authentication authentication,
            @RequestParam("title") String title,
            @RequestParam(value = "visibility", required = false) String visibility,
            @RequestParam("midi") MultipartFile midiFile,
            @RequestParam("sample") MultipartFile sampleFile
    ) throws Exception {
        User owner = userRepository.findByEmail(authentication.getName()).orElseThrow();
        UserUploadResponse response = userUploadService.uploadProject(
                owner,
                title,
                visibility,
                midiFile,
                sampleFile
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    private User viewerOrNull(Authentication authentication) {
        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            return null;
        }

        return userRepository.findByEmail(authentication.getName()).orElse(null);
    }
}
