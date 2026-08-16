package icepunk_backend.controller;

import icepunk_backend.dto.GeneratedPackResponse;
import icepunk_backend.dto.PublicGeneratedPackFeedResponse;
import icepunk_backend.dto.RenameGeneratedPackRequest;
import icepunk_backend.dto.UpdateGeneratedPackVisibilityRequest;
import icepunk_backend.dto.GenerationRequest.GenerationSource;
import icepunk_backend.dto.GenerationRequest.GenerationType;
import icepunk_backend.model.GeneratedPackVisibility;
import icepunk_backend.model.User;
import icepunk_backend.repository.UserRepository;
import icepunk_backend.service.GeneratedPackService;
import icepunk_backend.service.GeneratedPackService.DownloadObject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class GeneratedPackControllerTest {

    private GeneratedPackService generatedPackService;
    private UserRepository userRepository;
    private GeneratedPackController controller;

    private User testUser;
    private UUID packId;

    @BeforeEach
    void setUp() {
        generatedPackService = mock(GeneratedPackService.class);
        userRepository = mock(UserRepository.class);
        controller = new GeneratedPackController(generatedPackService, userRepository);

        testUser = new User("maco", "maco@example.com", "hash");
        testUser.setId(10L);

        packId = UUID.randomUUID();
    }

    @Test
    void getPackReturnsOkWhenFound() {
        GeneratedPackResponse packResponse = new GeneratedPackResponse(
                packId,
                "Cold Melodies",
                "FACTORY",
                "MELODY",
                140,
                0,
                2,
                5,
                OffsetDateTime.now(),
                "/generated-packs/" + packId + "/download",
                List.of()
        );
        when(generatedPackService.getPack(packId, null)).thenReturn(Optional.of(packResponse));

        ResponseEntity<GeneratedPackResponse> response = controller.getPack(null, packId);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(packResponse, response.getBody());
    }

    @Test
    void getPackReturnsNotFoundWhenMissing() {
        when(generatedPackService.getPack(packId, null)).thenReturn(Optional.empty());

        ResponseEntity<GeneratedPackResponse> response = controller.getPack(null, packId);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
    }

    @Test
    void publicFeedDelegatesToService() {
        PublicGeneratedPackFeedResponse feedResponse = new PublicGeneratedPackFeedResponse(
                List.of(), 0, 10, 0, 0, false
        );
        when(generatedPackService.getPublicFeed(0, 10)).thenReturn(feedResponse);

        PublicGeneratedPackFeedResponse response = controller.publicFeed(0, 10);

        assertEquals(feedResponse, response);
        verify(generatedPackService).getPublicFeed(0, 10);
    }

    @Test
    void publicFeedByUsernameDelegatesToService() {
        PublicGeneratedPackFeedResponse feedResponse = new PublicGeneratedPackFeedResponse(
                List.of(), 0, 6, 1, 1, false
        );
        when(generatedPackService.getPublicFeedByUsername("maco", 0, 6)).thenReturn(feedResponse);

        PublicGeneratedPackFeedResponse response = controller.publicFeedByUsername("maco", 0, 6);

        assertEquals(feedResponse, response);
        verify(generatedPackService).getPublicFeedByUsername("maco", 0, 6);
    }

    @Test
    void downloadPackReturnsOkWithContent() {
        byte[] bytes = new byte[]{1, 2, 3, 4};
        DownloadObject download = new DownloadObject(bytes, "pack.zip", "application/zip");
        when(generatedPackService.getPackDownload(packId, null)).thenReturn(Optional.of(download));

        ResponseEntity<ByteArrayResource> response = controller.downloadPack(null, packId);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(4, response.getBody().getByteArray().length);
    }

    @Test
    void downloadItemReturnsOkWithContent() {
        UUID itemId = UUID.randomUUID();
        byte[] bytes = new byte[]{5, 6, 7};
        DownloadObject download = new DownloadObject(bytes, "item.mid", "audio/midi");
        when(generatedPackService.getItemDownload(packId, itemId, null)).thenReturn(Optional.of(download));

        ResponseEntity<ByteArrayResource> response = controller.downloadItem(null, packId, itemId);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(3, response.getBody().getByteArray().length);
    }

    @Test
    void listMyPacksResolvesUserAndReturnsList() {
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken("maco@example.com", null);
        when(userRepository.findByEmail("maco@example.com")).thenReturn(Optional.of(testUser));
        when(generatedPackService.listPacksByOwner(testUser)).thenReturn(List.of());

        List<GeneratedPackResponse> response = controller.listMyPacks(auth);

        assertNotNull(response);
        verify(generatedPackService).listPacksByOwner(testUser);
    }

    @Test
    void renamePackDelegatesToService() {
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken("maco@example.com", null);
        when(userRepository.findByEmail("maco@example.com")).thenReturn(Optional.of(testUser));

        RenameGeneratedPackRequest request = new RenameGeneratedPackRequest("New Pack Name");
        GeneratedPackResponse packResponse = new GeneratedPackResponse(
                packId, "New Pack Name", "FACTORY", "MELODY", 140, 0, 2, 5, OffsetDateTime.now(), "/download", List.of()
        );
        when(generatedPackService.renamePack(packId, testUser, "New Pack Name")).thenReturn(packResponse);

        GeneratedPackResponse response = controller.renamePack(auth, packId, request);

        assertEquals(packResponse, response);
        verify(generatedPackService).renamePack(packId, testUser, "New Pack Name");
    }

    @Test
    void updateVisibilityDelegatesToService() {
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken("maco@example.com", null);
        when(userRepository.findByEmail("maco@example.com")).thenReturn(Optional.of(testUser));

        UpdateGeneratedPackVisibilityRequest request = new UpdateGeneratedPackVisibilityRequest(GeneratedPackVisibility.PRIVATE);
        GeneratedPackResponse packResponse = new GeneratedPackResponse(
                packId, "Cold Melodies", "FACTORY", "MELODY", 140, 0, 2, 5, OffsetDateTime.now(), "/download", List.of()
        );
        when(generatedPackService.updateVisibility(packId, testUser, GeneratedPackVisibility.PRIVATE)).thenReturn(packResponse);

        GeneratedPackResponse response = controller.updateVisibility(auth, packId, request);

        assertEquals(packResponse, response);
        verify(generatedPackService).updateVisibility(packId, testUser, GeneratedPackVisibility.PRIVATE);
    }

    @Test
    void deletePackDelegatesToServiceAndReturnsNoContent() {
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken("maco@example.com", null);
        when(userRepository.findByEmail("maco@example.com")).thenReturn(Optional.of(testUser));

        ResponseEntity<Void> response = controller.deletePack(auth, packId);

        assertEquals(HttpStatus.NO_CONTENT, response.getStatusCode());
        verify(generatedPackService).deletePack(packId, testUser);
    }
}
