package icepunk_backend.controller;

import icepunk_backend.model.User;
import icepunk_backend.repository.UserRepository;
import icepunk_backend.service.GenerationLimitService;
import icepunk_backend.service.MidiGenerationService;
import icepunk_backend.service.ZipStorageService;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.ResponseEntity;

import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.file.Files;
import java.nio.file.Path;

@RestController
@CrossOrigin(origins = "http://localhost:3000")
public class GenerateController {

    private final MidiGenerationService midiGenerationService;
    private final GenerationLimitService generationLimitService;
    private final UserRepository userRepository;
    private final ZipStorageService zipStorageService;

    public GenerateController(
            MidiGenerationService midiGenerationService,
            GenerationLimitService generationLimitService,
            UserRepository userRepository,
            ZipStorageService zipStorageService
    ) {
        this.midiGenerationService = midiGenerationService;
        this.generationLimitService = generationLimitService;
        this.userRepository = userRepository;
        this.zipStorageService = zipStorageService;
    }

    @GetMapping("/generate")
    public ResponseEntity<GenerateResponse> generate(HttpServletRequest request) throws Exception {

        Authentication authentication = SecurityContextHolder
                .getContext()
                .getAuthentication();

        if (
                authentication != null
                        && authentication.isAuthenticated()
                        && !(authentication instanceof AnonymousAuthenticationToken)
        ) {
            String email = authentication.getName();

            User user = userRepository.findByEmail(email)
                    .orElseThrow();

            generationLimitService.checkAndIncreaseUserLimit(user);
        } else {
            String ipAddress = request.getRemoteAddr();
            generationLimitService.checkAndIncreaseGuestLimit(ipAddress);
        }

        Path zipPath = midiGenerationService.generateZip();

        String downloadUrl = zipStorageService.uploadZip(zipPath);

        Files.deleteIfExists(zipPath);

        return ResponseEntity.ok(
                new GenerateResponse(downloadUrl)
        );
    }

    public static class GenerateResponse {

        private final String downloadUrl;

        public GenerateResponse(String downloadUrl) {
            this.downloadUrl = downloadUrl;
        }

        public String getDownloadUrl() {
            return downloadUrl;
        }
    }
}