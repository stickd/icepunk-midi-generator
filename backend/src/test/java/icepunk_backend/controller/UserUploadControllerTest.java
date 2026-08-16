package icepunk_backend.controller;

import icepunk_backend.dto.PublicUploadFeedResponse;
import icepunk_backend.dto.UserUploadResponse;
import icepunk_backend.model.UploadVisibility;
import icepunk_backend.model.User;
import icepunk_backend.repository.UserRepository;
import icepunk_backend.service.UserUploadService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserUploadControllerTest {

    private final UserUploadService userUploadService = mock(UserUploadService.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final UserUploadController controller = new UserUploadController(userUploadService, userRepository);

    @Test
    void uploadProjectUsesAuthenticatedOwnerAndReturnsCreatedUploadInformation() throws Exception {
        User owner = new User("nikul", "nikul@example.com", "hash");
        owner.setId(42L);

        MockMultipartFile midi = new MockMultipartFile(
                "midi", "lead.mid", "audio/midi", new byte[]{1, 2, 3});
        MockMultipartFile sample = new MockMultipartFile(
                "sample", "kick.wav", "audio/wav", new byte[]{4, 5, 6});
        UserUploadResponse uploadResponse = new UserUploadResponse(
                7L,
                42L,
                "Frozen Lead",
                "user_uploads/42/lead.mid",
                "/uploads/projects/7/midi",
                "user_uploads/42/kick.wav",
                null,
                OffsetDateTime.parse("2026-07-02T21:00:00Z"),
                UploadVisibility.PUBLIC,
                Map.of("midiSizeBytes", 3L)
        );

        when(userRepository.findByEmail("nikul@example.com")).thenReturn(Optional.of(owner));
        when(userUploadService.uploadProject(owner, "Frozen Lead", "PUBLIC", midi, sample))
                .thenReturn(uploadResponse);

        ResponseEntity<UserUploadResponse> response = controller.uploadProject(
                new UsernamePasswordAuthenticationToken("nikul@example.com", null),
                "Frozen Lead",
                "PUBLIC",
                midi,
                sample
        );

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertEquals(uploadResponse, response.getBody());
        verify(userRepository).findByEmail("nikul@example.com");
        verify(userUploadService).uploadProject(owner, "Frozen Lead", "PUBLIC", midi, sample);
    }

    @Test
    void publicFeedDelegatesToUploadService() {
        PublicUploadFeedResponse feedResponse = new PublicUploadFeedResponse(
                List.of(),
                1,
                5,
                0,
                0,
                false
        );
        when(userUploadService.getPublicFeed(1, 5)).thenReturn(feedResponse);

        PublicUploadFeedResponse response = controller.publicFeed(1, 5);

        assertEquals(feedResponse, response);
        verify(userUploadService).getPublicFeed(1, 5);
    }

    @Test
    void publicProjectMidiReturnsStreamedMidiFile() {
        UserUploadService.PublicMidiFile midiFile = new UserUploadService.PublicMidiFile(
                new byte[]{77, 84, 104, 100},
                "audio/midi",
                "lead.mid"
        );
        when(userUploadService.getMidiFile(7L, null)).thenReturn(Optional.of(midiFile));

        ResponseEntity<byte[]> response = controller.projectMidi(null, 7L);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("audio/midi", response.getHeaders().getContentType().toString());
        assertEquals("inline; filename=\"lead.mid\"", response.getHeaders().getFirst("Content-Disposition"));
        assertEquals(4, response.getBody().length);
    }

    @Test
    void publicProjectMidiReturnsNotFoundForMissingOrPrivateProject() {
        when(userUploadService.getMidiFile(7L, null)).thenReturn(Optional.empty());

        ResponseEntity<byte[]> response = controller.projectMidi(null, 7L);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
    }
}
