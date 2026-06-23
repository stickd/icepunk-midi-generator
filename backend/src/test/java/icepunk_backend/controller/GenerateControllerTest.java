package icepunk_backend.controller;

import icepunk_backend.model.User;
import icepunk_backend.repository.UserRepository;
import icepunk_backend.service.ClientIpService;
import icepunk_backend.service.GenerationLimitService;
import icepunk_backend.service.GenerationStatsService;
import icepunk_backend.service.MidiGenerationService;
import icepunk_backend.service.ZipStorageService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.InOrder;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
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
    private final ZipStorageService zipStorageService = mock(ZipStorageService.class);
    private final ClientIpService clientIpService = mock(ClientIpService.class);

    private final GenerateController controller = new GenerateController(
            midiGenerationService,
            generationLimitService,
            generationStatsService,
            userRepository,
            zipStorageService,
            clientIpService
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
        when(midiGenerationService.generateZip())
                .thenThrow(new RuntimeException("Server is busy. Try again later."));

        assertThrows(RuntimeException.class, () -> controller.generate(request));

        verify(generationLimitService).checkGuestLimit("127.0.0.1");
        verify(generationLimitService, never()).incrementGuestUsage("127.0.0.1");
        verify(generationStatsService, never()).incrementTotalGenerations();
        verify(zipStorageService, never()).uploadZip(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void generationErrorDoesNotIncrementUserUsageOrGlobalCounter() throws Exception {
        User user = authenticatedUser();
        when(midiGenerationService.generateZip())
                .thenThrow(new RuntimeException("Python generator failed"));

        assertThrows(RuntimeException.class, () -> controller.generate(new MockHttpServletRequest()));

        verify(generationLimitService).checkUserLimit(user);
        verify(generationLimitService, never()).incrementUserUsage(user);
        verify(generationStatsService, never()).incrementTotalGenerations();
        verify(zipStorageService, never()).uploadZip(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void uploadErrorDoesNotIncrementGuestUsageOrGlobalCounter() throws Exception {
        MockHttpServletRequest request = guestRequest();
        Path zipPath = createZipFile();
        when(midiGenerationService.generateZip()).thenReturn(zipPath);
        when(zipStorageService.uploadZip(zipPath)).thenThrow(new RuntimeException("S3 upload failed"));

        assertThrows(RuntimeException.class, () -> controller.generate(request));

        verify(generationLimitService).checkGuestLimit("127.0.0.1");
        verify(generationLimitService, never()).incrementGuestUsage("127.0.0.1");
        verify(generationStatsService, never()).incrementTotalGenerations();
        assertFalse(Files.exists(zipPath));
    }

    @Test
    void successfulGuestGenerationIncrementsUsageAndGlobalCounterOnce() throws Exception {
        MockHttpServletRequest request = guestRequest();
        Path zipPath = createZipFile();
        when(midiGenerationService.generateZip()).thenReturn(zipPath);
        when(zipStorageService.uploadZip(zipPath)).thenReturn("https://cdn.example/pack.zip");
        when(generationStatsService.incrementTotalGenerations()).thenReturn(42L);

        GenerateController.GenerateResponse response = controller.generate(request).getBody();

        assertEquals("https://cdn.example/pack.zip", response.getDownloadUrl());
        assertEquals(42L, response.getTotalGenerations());
        assertFalse(Files.exists(zipPath));

        InOrder inOrder = inOrder(
                generationLimitService,
                midiGenerationService,
                zipStorageService,
                generationStatsService
        );
        inOrder.verify(generationLimitService).checkGuestLimit("127.0.0.1");
        inOrder.verify(midiGenerationService).generateZip();
        inOrder.verify(zipStorageService).uploadZip(zipPath);
        inOrder.verify(generationLimitService).incrementGuestUsage("127.0.0.1");
        inOrder.verify(generationStatsService).incrementTotalGenerations();
    }

    @Test
    void successfulUserGenerationIncrementsUsageAndGlobalCounterOnce() throws Exception {
        User user = authenticatedUser();
        Path zipPath = createZipFile();
        when(midiGenerationService.generateZip()).thenReturn(zipPath);
        when(zipStorageService.uploadZip(zipPath)).thenReturn("https://cdn.example/user-pack.zip");
        when(generationStatsService.incrementTotalGenerations()).thenReturn(43L);

        GenerateController.GenerateResponse response =
                controller.generate(new MockHttpServletRequest()).getBody();

        assertEquals("https://cdn.example/user-pack.zip", response.getDownloadUrl());
        assertEquals(43L, response.getTotalGenerations());
        assertFalse(Files.exists(zipPath));

        verify(generationLimitService).checkUserLimit(user);
        verify(generationLimitService).incrementUserUsage(user);
        verify(generationStatsService).incrementTotalGenerations();
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

    private Path createZipFile() throws Exception {
        Path zipPath = tempDir.resolve("pack.zip");
        Files.writeString(zipPath, "zip");
        return zipPath;
    }
}
