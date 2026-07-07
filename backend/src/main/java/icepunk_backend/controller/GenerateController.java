package icepunk_backend.controller;

import icepunk_backend.dto.GenerationRequest;
import icepunk_backend.dto.GenerationResponse;
import icepunk_backend.dto.GeneratedPackResponse;
import icepunk_backend.exception.GenerationRequestException;
import icepunk_backend.model.User;
import icepunk_backend.repository.UserRepository;
import icepunk_backend.service.DatasetPresetService;
import icepunk_backend.service.GenerationLimitService;
import icepunk_backend.service.GenerationStatsService;
import icepunk_backend.service.GeneratedPackService;
import icepunk_backend.service.MidiGenerationService;
import icepunk_backend.service.TempAnalysisService;
import icepunk_backend.service.ClientIpService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;

import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.file.Path;

@RestController
public class GenerateController {

    private final MidiGenerationService midiGenerationService;
    private final GenerationLimitService generationLimitService;
    private final GenerationStatsService generationStatsService;
    private final UserRepository userRepository;
    private final ClientIpService clientIpService;
    private final TempAnalysisService tempAnalysisService;
    private final GeneratedPackService generatedPackService;
    private final DatasetPresetService datasetPresetService;

    public GenerateController(
            MidiGenerationService midiGenerationService,
            GenerationLimitService generationLimitService,
            GenerationStatsService generationStatsService,
            UserRepository userRepository,
            ClientIpService clientIpService,
            TempAnalysisService tempAnalysisService,
            GeneratedPackService generatedPackService,
            DatasetPresetService datasetPresetService
    ) {
        this.midiGenerationService = midiGenerationService;
        this.generationLimitService = generationLimitService;
        this.generationStatsService = generationStatsService;
        this.userRepository = userRepository;
        this.clientIpService = clientIpService;
        this.tempAnalysisService = tempAnalysisService;
        this.generatedPackService = generatedPackService;
        this.datasetPresetService = datasetPresetService;
    }

    public ResponseEntity<GenerationResponse> generate(HttpServletRequest request) throws Exception {
        return generate(request, null);
    }

    @GetMapping("/generation-usage")
    public GenerationLimitService.GenerationUsage getGenerationUsage(HttpServletRequest request) {
        Authentication authentication = SecurityContextHolder
                .getContext()
                .getAuthentication();

        if (
                authentication != null
                        && authentication.isAuthenticated()
                        && !(authentication instanceof AnonymousAuthenticationToken)
        ) {
            User user = userRepository.findByEmail(authentication.getName())
                    .orElseThrow();

            return generationLimitService.getUserUsage(user);
        }

        String ipAddress = clientIpService.getClientIp(request);
        return generationLimitService.getGuestUsage(ipAddress);
    }

    @PostMapping("/generate")
    public ResponseEntity<GenerationResponse> generate(
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

        MidiGenerationService.GeneratedFiles generatedFiles = null;

        try {
            generatedFiles = midiGenerationService.generateFiles(
                    resolveAnalysisFile(resolvedRequest, generationActor.user),
                    resolvedRequest
            );
            GeneratedPackResponse generatedPack = generatedPackService.persistGeneratedPack(
                    generationActor.user,
                    resolvedRequest,
                    generatedFiles
            );

            if (generationActor.user != null) {
                generationLimitService.incrementUserUsage(generationActor.user);
            } else {
                generationLimitService.incrementGuestUsage(generationActor.ipAddress);
            }

            long totalGenerations = generationStatsService.incrementTotalGenerations();

            return ResponseEntity.ok(toGenerationResponse(generatedPack, totalGenerations));
        } finally {
            if (generatedFiles != null) {
                generatedFiles.close();
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

    private Path resolveAnalysisFile(GenerationRequest request, User user) {
        if (request.getSource() == GenerationRequest.GenerationSource.FACTORY) {
            return null;
        }

        if (request.getSource() == GenerationRequest.GenerationSource.CUSTOM_UPLOAD) {
            boolean hasDatasets = request.getDatasetIds() != null && !request.getDatasetIds().isEmpty();
            boolean hasFactoryPool = request.isIncludeFactoryPool();

            if (hasDatasets || hasFactoryPool) {
                if (user == null) {
                    throw new GenerationRequestException("Sign in to generate from saved datasets.");
                }

                return datasetPresetService.resolveMergedAnalysisFile(request.getDatasetIds(), hasFactoryPool, user);
            }

            return tempAnalysisService.resolveAnalysisFile(request.getTempAnalysisId());
        }

        throw new GenerationRequestException("Unsupported generation source.");
    }

    private GenerationResponse toGenerationResponse(GeneratedPackResponse pack, long totalGenerations) {
        return new GenerationResponse(
                pack.packId(),
                pack.name(),
                pack.source(),
                pack.type(),
                pack.bpm(),
                pack.pitch(),
                pack.octaves(),
                pack.amount(),
                pack.createdAt(),
                pack.packDownloadUrl(),
                pack.packDownloadUrl(),
                totalGenerations,
                pack.items()
        );
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
