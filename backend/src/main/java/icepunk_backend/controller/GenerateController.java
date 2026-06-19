package icepunk_backend.controller;

import icepunk_backend.model.User;
import icepunk_backend.repository.UserRepository;
import icepunk_backend.service.GenerationLimitService;
import icepunk_backend.service.GenerationStatsService;
import icepunk_backend.service.MidiGenerationService;
import icepunk_backend.service.ZipStorageService;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.ResponseEntity;

import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.file.Files;
import java.nio.file.Path;

@RestController
public class GenerateController {

    private final MidiGenerationService midiGenerationService;
    private final GenerationLimitService generationLimitService;
    private final GenerationStatsService generationStatsService;
    private final UserRepository userRepository;
    private final ZipStorageService zipStorageService;

    public GenerateController(
            MidiGenerationService midiGenerationService,
            GenerationLimitService generationLimitService,
            GenerationStatsService generationStatsService,
            UserRepository userRepository,
            ZipStorageService zipStorageService
    ) {
        this.midiGenerationService = midiGenerationService;
        this.generationLimitService = generationLimitService;
        this.generationStatsService = generationStatsService;
        this.userRepository = userRepository;
        this.zipStorageService = zipStorageService;
    }

    @PostMapping("/generate")
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

        long totalGenerations = generationStatsService.incrementTotalGenerations();

        Files.deleteIfExists(zipPath);

        return ResponseEntity.ok(
                new GenerateResponse(downloadUrl, totalGenerations)
        );
    }

    public static class GenerateResponse {

        private final String downloadUrl;
        private final long totalGenerations;

        public GenerateResponse(String downloadUrl, long totalGenerations) {
            this.downloadUrl = downloadUrl;
            this.totalGenerations = totalGenerations;
        }

        public String getDownloadUrl() {
            return downloadUrl;
        }

        public long getTotalGenerations() {
            return totalGenerations;
        }
    }
}