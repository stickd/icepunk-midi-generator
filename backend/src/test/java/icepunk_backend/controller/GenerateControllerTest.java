package icepunk_backend.controller;

import icepunk_backend.dto.GeneratedPackResponse;
import icepunk_backend.dto.GenerationRequest;
import icepunk_backend.dto.GenerationResponse;
import icepunk_backend.exception.GenerationRequestException;
import icepunk_backend.model.User;
import icepunk_backend.repository.UserRepository;
import icepunk_backend.service.ClientIpService;
import icepunk_backend.service.DatasetPresetService;
import icepunk_backend.service.GeneratedPackService;
import icepunk_backend.service.GenerationLimitService;
import icepunk_backend.service.GenerationStatsService;
import icepunk_backend.service.MidiGenerationService;
import icepunk_backend.service.TempAnalysisService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.InOrder;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class GenerateControllerTest {

    private final MidiGenerationService midiGenerationService = mock(MidiGenerationService.class);
    private final GenerationLimitService generationLimitService = mock(GenerationLimitService.class);
    private final GenerationStatsService generationStatsService = mock(GenerationStatsService.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final ClientIpService clientIpService = mock(ClientIpService.class);
    private final TempAnalysisService tempAnalysisService = mock(TempAnalysisService.class);
    private final GeneratedPackService generatedPackService = mock(GeneratedPackService.class);
    private final DatasetPresetService datasetPresetService = mock(DatasetPresetService.class);

    private final GenerateController controller = new GenerateController(
            midiGenerationService,
            generationLimitService,
            generationStatsService,
            userRepository,
            clientIpService,
            tempAnalysisService,
            generatedPackService,
            datasetPresetService
    );

    @TempDir
    Path tempDir;

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void busyServerDoesNotIncrementGuestUsageOrGlobalCounter() throws Exception {
        MockHttpServletRequest request = guestRequest();
        when(midiGenerationService.generateFiles(isNull(), any()))
                .thenThrow(new RuntimeException("Server is busy. Try again later."));

        assertThrows(RuntimeException.class, () -> controller.generate(request, factoryRequest()));

        verify(generationLimitService).checkGuestLimit("127.0.0.1");
        verify(generationLimitService, never()).incrementGuestUsage("127.0.0.1");
        verify(generationStatsService, never()).incrementTotalGenerations();
        verify(generatedPackService, never()).persistGeneratedPack(any(), any(), any());
    }

    @Test
    void generationErrorDoesNotIncrementUserUsageOrGlobalCounter() throws Exception {
        User user = authenticatedUser();
        when(midiGenerationService.generateFiles(isNull(), any()))
                .thenThrow(new RuntimeException("Python generator failed"));

        assertThrows(RuntimeException.class, () -> controller.generate(new MockHttpServletRequest(), factoryRequest()));

        verify(generationLimitService).checkUserLimit(user);
        verify(generationLimitService, never()).incrementUserUsage(user);
        verify(generationStatsService, never()).incrementTotalGenerations();
        verify(generatedPackService, never()).persistGeneratedPack(any(), any(), any());
    }

    @Test
    void packPersistenceErrorDoesNotIncrementGuestUsageOrGlobalCounter() throws Exception {
        MockHttpServletRequest request = guestRequest();
        MidiGenerationService.GeneratedFiles generatedFiles = createGeneratedFiles();
        when(midiGenerationService.generateFiles(isNull(), any())).thenReturn(generatedFiles);
        when(generatedPackService.persistGeneratedPack(isNull(), any(), eq(generatedFiles)))
                .thenThrow(new RuntimeException("S3 upload failed"));

        assertThrows(RuntimeException.class, () -> controller.generate(request, factoryRequest()));

        verify(generationLimitService).checkGuestLimit("127.0.0.1");
        verify(generationLimitService, never()).incrementGuestUsage("127.0.0.1");
        verify(generationStatsService, never()).incrementTotalGenerations();
        assertFalse(Files.exists(generatedFiles.zipPath()));
        assertFalse(Files.exists(generatedFiles.outputDir()));
    }

    @Test
    void successfulGuestGenerationIncrementsUsageAndGlobalCounterOnce() throws Exception {
        MockHttpServletRequest request = guestRequest();
        MidiGenerationService.GeneratedFiles generatedFiles = createGeneratedFiles();
        GenerationRequest generationRequest = factoryRequest();
        GeneratedPackResponse packResponse = packResponse("https://cdn.example/pack.zip");
        when(midiGenerationService.generateFiles(isNull(), eq(generationRequest))).thenReturn(generatedFiles);
        when(generatedPackService.persistGeneratedPack(isNull(), eq(generationRequest), eq(generatedFiles)))
                .thenReturn(packResponse);
        when(generationStatsService.incrementTotalGenerations()).thenReturn(42L);

        GenerationResponse response = controller.generate(request, generationRequest).getBody();

        assertEquals("https://cdn.example/pack.zip", response.downloadUrl());
        assertEquals("https://cdn.example/pack.zip", response.packDownloadUrl());
        assertEquals(42L, response.totalGenerations());
        assertFalse(Files.exists(generatedFiles.zipPath()));
        assertFalse(Files.exists(generatedFiles.outputDir()));

        InOrder inOrder = inOrder(
                generationLimitService,
                midiGenerationService,
                generatedPackService,
                generationStatsService
        );
        inOrder.verify(generationLimitService).checkGuestLimit("127.0.0.1");
        inOrder.verify(midiGenerationService).generateFiles(isNull(), eq(generationRequest));
        inOrder.verify(generatedPackService).persistGeneratedPack(isNull(), eq(generationRequest), eq(generatedFiles));
        inOrder.verify(generationLimitService).incrementGuestUsage("127.0.0.1");
        inOrder.verify(generationStatsService).incrementTotalGenerations();
    }

    @Test
    void successfulUserGenerationIncrementsUsageAndGlobalCounterOnce() throws Exception {
        User user = authenticatedUser();
        MidiGenerationService.GeneratedFiles generatedFiles = createGeneratedFiles();
        GenerationRequest generationRequest = factoryRequest();
        when(midiGenerationService.generateFiles(isNull(), eq(generationRequest))).thenReturn(generatedFiles);
        when(generatedPackService.persistGeneratedPack(eq(user), eq(generationRequest), eq(generatedFiles)))
                .thenReturn(packResponse("https://cdn.example/user-pack.zip"));
        when(generationStatsService.incrementTotalGenerations()).thenReturn(43L);

        GenerationResponse response =
                controller.generate(new MockHttpServletRequest(), generationRequest).getBody();

        assertEquals("https://cdn.example/user-pack.zip", response.downloadUrl());
        assertEquals(43L, response.totalGenerations());
        assertFalse(Files.exists(generatedFiles.zipPath()));
        assertFalse(Files.exists(generatedFiles.outputDir()));

        verify(generationLimitService).checkUserLimit(user);
        verify(generationLimitService).incrementUserUsage(user);
        verify(generationStatsService).incrementTotalGenerations();
    }

    @Test
    void factoryGenerationUsesBundledAnalysisByPassingNoCustomAnalysisPath() throws Exception {
        MockHttpServletRequest request = guestRequest();
        MidiGenerationService.GeneratedFiles generatedFiles = createGeneratedFiles();
        GenerationRequest generationRequest = factoryRequest();
        when(midiGenerationService.generateFiles(isNull(), eq(generationRequest))).thenReturn(generatedFiles);
        when(generatedPackService.persistGeneratedPack(isNull(), eq(generationRequest), eq(generatedFiles)))
                .thenReturn(packResponse("https://cdn.example/factory.zip"));
        when(generationStatsService.incrementTotalGenerations()).thenReturn(7L);

        GenerationResponse response = controller.generate(request, generationRequest).getBody();

        assertEquals("https://cdn.example/factory.zip", response.downloadUrl());
        verify(tempAnalysisService, never()).resolveAnalysisFile(any());
        verify(midiGenerationService).generateFiles(isNull(), eq(generationRequest));
    }

    @Test
    void customUploadGenerationUsesResolvedTempAnalysisPath() throws Exception {
        MockHttpServletRequest request = guestRequest();
        Path analysisPath = tempDir.resolve("analysis.json");
        Files.writeString(analysisPath, "{}");
        MidiGenerationService.GeneratedFiles generatedFiles = createGeneratedFiles();
        GenerationRequest generationRequest = factoryRequest();
        generationRequest.setSource(GenerationRequest.GenerationSource.CUSTOM_UPLOAD);
        generationRequest.setTempAnalysisId("11111111-1111-1111-1111-111111111111");
        when(tempAnalysisService.resolveAnalysisFile("11111111-1111-1111-1111-111111111111"))
                .thenReturn(analysisPath);
        when(midiGenerationService.generateFiles(analysisPath, generationRequest)).thenReturn(generatedFiles);
        when(generatedPackService.persistGeneratedPack(isNull(), eq(generationRequest), eq(generatedFiles)))
                .thenReturn(packResponse("https://cdn.example/custom.zip"));
        when(generationStatsService.incrementTotalGenerations()).thenReturn(8L);

        GenerationResponse response = controller.generate(request, generationRequest).getBody();

        assertEquals("https://cdn.example/custom.zip", response.downloadUrl());
        verify(tempAnalysisService).resolveAnalysisFile("11111111-1111-1111-1111-111111111111");
        verify(midiGenerationService).generateFiles(analysisPath, generationRequest);
    }

    @Test
    void customUploadWithoutTempAnalysisIdIsRejected() throws Exception {
        MockHttpServletRequest request = guestRequest();
        GenerationRequest generationRequest = factoryRequest();
        generationRequest.setSource(GenerationRequest.GenerationSource.CUSTOM_UPLOAD);
        generationRequest.setTempAnalysisId(null);
        when(tempAnalysisService.resolveAnalysisFile(null))
                .thenThrow(new GenerationRequestException("A valid tempAnalysisId is required for custom upload generation."));

        assertThrows(
                GenerationRequestException.class,
                () -> controller.generate(request, generationRequest)
        );

        verify(generationLimitService).checkGuestLimit("127.0.0.1");
        verify(midiGenerationService, never()).generateFiles(any(), any());
        verify(generationLimitService, never()).incrementGuestUsage("127.0.0.1");
    }

    @Test
    void customUploadWithDatasetIdsUsesMergedAnalysisPath() throws Exception {
        User user = authenticatedUser();
        Path mergedAnalysisPath = tempDir.resolve("merged-analysis.json");
        Files.writeString(mergedAnalysisPath, "{}");
        MidiGenerationService.GeneratedFiles generatedFiles = createGeneratedFiles();
        GenerationRequest generationRequest = factoryRequest();
        generationRequest.setSource(GenerationRequest.GenerationSource.CUSTOM_UPLOAD);
        UUID datasetId = UUID.randomUUID();
        generationRequest.setDatasetIds(List.of(datasetId));
        generationRequest.setIncludeFactoryPool(true);
        when(datasetPresetService.resolveMergedAnalysisFile(List.of(datasetId), true, user))
                .thenReturn(mergedAnalysisPath);
        when(midiGenerationService.generateFiles(mergedAnalysisPath, generationRequest)).thenReturn(generatedFiles);
        when(generatedPackService.persistGeneratedPack(eq(user), eq(generationRequest), eq(generatedFiles)))
                .thenReturn(packResponse("https://cdn.example/dataset-mix.zip"));
        when(generationStatsService.incrementTotalGenerations()).thenReturn(9L);

        GenerationResponse response =
                controller.generate(new MockHttpServletRequest(), generationRequest).getBody();

        assertEquals("https://cdn.example/dataset-mix.zip", response.downloadUrl());
        verify(datasetPresetService).resolveMergedAnalysisFile(List.of(datasetId), true, user);
        verify(tempAnalysisService, never()).resolveAnalysisFile(any());
        verify(midiGenerationService).generateFiles(mergedAnalysisPath, generationRequest);
    }

    @Test
    void customUploadWithDatasetIdsIsRejectedForGuests() throws Exception {
        MockHttpServletRequest request = guestRequest();
        GenerationRequest generationRequest = factoryRequest();
        generationRequest.setSource(GenerationRequest.GenerationSource.CUSTOM_UPLOAD);
        generationRequest.setDatasetIds(List.of(UUID.randomUUID()));

        assertThrows(
                GenerationRequestException.class,
                () -> controller.generate(request, generationRequest)
        );

        verify(datasetPresetService, never()).resolveMergedAnalysisFile(any(), anyBoolean(), any());
        verify(midiGenerationService, never()).generateFiles(any(), any());
    }

    private MockHttpServletRequest guestRequest() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("127.0.0.1");
        when(clientIpService.getClientIp(request)).thenReturn("127.0.0.1");
        return request;
    }

    private User authenticatedUser() {
        User user = new User("nikul", "nikul@example.com", "hash");
        when(userRepository.findByEmail("nikul@example.com")).thenReturn(Optional.of(user));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("nikul@example.com", null, List.of())
        );
        when(clientIpService.getClientIp(org.mockito.ArgumentMatchers.any())).thenReturn("127.0.0.1");
        return user;
    }

    private MidiGenerationService.GeneratedFiles createGeneratedFiles() throws Exception {
        Path outputDir = Files.createDirectories(tempDir.resolve("generated-" + UUID.randomUUID()));
        Path midiPath = outputDir.resolve("track.mid");
        Files.writeString(midiPath, "midi");
        Path zipPath = tempDir.resolve("pack-" + UUID.randomUUID() + ".zip");
        Files.writeString(zipPath, "zip");
        return new MidiGenerationService.GeneratedFiles(outputDir, zipPath, List.of(midiPath));
    }

    private GeneratedPackResponse packResponse(String packDownloadUrl) {
        return new GeneratedPackResponse(
                UUID.randomUUID(),
                "Test Pack",
                "FACTORY",
                "MELODY",
                146,
                0,
                1,
                10,
                OffsetDateTime.parse("2026-07-03T12:00:00Z"),
                packDownloadUrl,
                List.of()
        );
    }

    private GenerationRequest factoryRequest() {
        GenerationRequest request = new GenerationRequest();
        request.setSource(GenerationRequest.GenerationSource.FACTORY);
        request.setAmount(10);
        request.setPackName("Test Pack");
        request.setType(GenerationRequest.GenerationType.MELODY);
        request.setBpm(146);
        request.setPitch(0);
        request.setOctaves(1);
        return request;
    }
}
