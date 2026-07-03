package icepunk_backend.controller;

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
                "https://cdn.example/user_uploads/42/lead.mid",
                "user_uploads/42/kick.wav",
                "https://cdn.example/user_uploads/42/kick.wav",
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
}
