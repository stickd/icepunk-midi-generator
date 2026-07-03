package icepunk_backend.controller;

import icepunk_backend.dto.GenerationRequest;
import icepunk_backend.exception.GenerationRequestException;
import icepunk_backend.model.User;
import icepunk_backend.repository.UserRepository;
import icepunk_backend.service.GenerationLimitService;
import icepunk_backend.service.GenerationStatsService;
import icepunk_backend.service.MidiGenerationService;
import icepunk_backend.service.TempAnalysisService;
import icepunk_backend.service.ZipStorageService;
import icepunk_backend.service.ClientIpService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;

import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import org.springframework.web.bind.annotation.RequestBody;
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
    private final ClientIpService clientIpService;
    private final TempAnalysisService tempAnalysisService;

    public GenerateController(
            MidiGenerationService midiGenerationService,
            GenerationLimitService generationLimitService,
            GenerationStatsService generationStatsService,
            UserRepository userRepository,
            ZipStorageService zipStorageService,
            ClientIpService clientIpService,
            TempAnalysisService tempAnalysisService
    ) {
        this.midiGenerationService = midiGenerationService;
        this.generationLimitService = generationLimitService;
        this.generationStatsService = generationStatsService;
        this.userRepository = userRepository;
        this.zipStorageService = zipStorageService;
        this.clientIpService = clientIpService;
        this.tempAnalysisService = tempAnalysisService;
    }

    public ResponseEntity<GenerateResponse> generate(HttpServletRequest request) throws Exception {
        return generate(request, null);
    }

    @PostMapping("/generate")
    public ResponseEntity<GenerateResponse> generate(
            HttpServletRequest request,
            @Valid @RequestBody(required = false) GenerationRequest generationRequest
    ) throws Exception {
        GenerationRequest resolvedRequest = normalizeRequest(generationRequest);

        Authentication authentication = SecurityContextHolder
                .getContext()
                .getAuthentication();

        String ipAddress = clientIpService.getClientIp(request);
        GenerationActor generationActor;

        if (
                authentication != null
                        && authentication.isAuthenticated()
                        && !(authentication instanceof AnonymousAuthenticationToken)
        ) {
            String email = authentication.getName();

            User user = userRepository.findByEmail(email)
                    .orElseThrow();

            generationLimitService.checkUserLimit(user);
            generationActor = GenerationActor.user(user, ipAddress);
        } else {
            generationLimitService.checkGuestLimit(ipAddress);
            generationActor = GenerationActor.guest(ipAddress);
        }

        Path zipPath = null;

        try {
            zipPath = midiGenerationService.generateZip(resolveAnalysisFile(resolvedRequest), resolvedRequest);

            String downloadUrl = zipStorageService.uploadZip(zipPath);

            if (generationActor.user != null) {
                generationLimitService.incrementUserUsage(generationActor.user);
            } else {
                generationLimitService.incrementGuestUsage(generationActor.ipAddress);
            }

            long totalGenerations = generationStatsService.incrementTotalGenerations();

            return ResponseEntity.ok(
                    new GenerateResponse(downloadUrl, totalGenerations)
            );
        } finally {
            if (zipPath != null) {
                Files.deleteIfExists(zipPath);
            }
        }
    }

    private GenerationRequest normalizeRequest(GenerationRequest request) {
        if (request == null) {
            return new GenerationRequest();
        }

        if (request.getSource() == null) {
            request.setSource(GenerationRequest.GenerationSource.FACTORY);
        }

        if (request.getType() == null) {
            request.setType(GenerationRequest.GenerationType.MELODY);
        }

        if (request.getPublishMode() == null) {
            request.setPublishMode(GenerationRequest.PublishMode.PUBLIC);
        }

        return request;
    }

    private Path resolveAnalysisFile(GenerationRequest request) {
        if (request.getSource() == GenerationRequest.GenerationSource.FACTORY) {
            return null;
        }

        if (request.getSource() == GenerationRequest.GenerationSource.CUSTOM_UPLOAD) {
            return tempAnalysisService.resolveAnalysisFile(request.getTempAnalysisId());
        }

        throw new GenerationRequestException("Unsupported generation source.");
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

    private static class GenerationActor {

        private final User user;
        private final String ipAddress;

        private GenerationActor(User user, String ipAddress) {
            this.user = user;
            this.ipAddress = ipAddress;
        }

        private static GenerationActor user(User user, String ipAddress) {
            return new GenerationActor(user, ipAddress);
        }

        private static GenerationActor guest(String ipAddress) {
            return new GenerationActor(null, ipAddress);
        }
    }
}
