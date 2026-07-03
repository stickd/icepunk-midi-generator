package icepunk_backend.service;

import icepunk_backend.dto.UserUploadResponse;
import icepunk_backend.exception.UploadValidationException;
import icepunk_backend.model.UploadVisibility;
import icepunk_backend.model.User;
import icepunk_backend.model.UserUploadedProject;
import icepunk_backend.repository.UserUploadedProjectRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockMultipartFile;

import java.io.InputStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserUploadServiceTest {

    private final UserUploadStorageService storageService = mock(UserUploadStorageService.class);
    private final UserUploadedProjectRepository projectRepository = mock(UserUploadedProjectRepository.class);

    private UserUploadService service;
    private User owner;

    @BeforeEach
    void setUp() throws Exception {
        service = new UserUploadService(storageService, projectRepository, 10, 20);

        owner = new User("nikul", "nikul@example.com", "hash");
        owner.setId(42L);

        when(storageService.upload(eq(42L), eq("lead.mid"), eq("audio/midi"), eq(4L), any(InputStream.class)))
                .thenReturn(new UserUploadStorageService.StoredUpload(
                        "user_uploads/42/midi.mid",
                        "https://cdn.example.com/user_uploads/42/midi.mid"
                ));
        when(storageService.upload(eq(42L), eq("kick.wav"), eq("audio/wav"), eq(5L), any(InputStream.class)))
                .thenReturn(new UserUploadStorageService.StoredUpload(
                        "user_uploads/42/kick.wav",
                        "https://cdn.example.com/user_uploads/42/kick.wav"
                ));
        when(projectRepository.save(any(UserUploadedProject.class))).thenAnswer(invocation -> {
            UserUploadedProject project = invocation.getArgument(0);
            project.setId(7L);
            return project;
        });
    }

    @Test
    void uploadProjectUploadsFilesSavesMetadataAndReturnsUploadInformation() throws Exception {
        UserUploadResponse response = service.uploadProject(
                owner,
                "  Frozen Lead  ",
                "UNLISTED",
                file("midi", "lead.mid", "audio/midi", new byte[]{1, 2, 3, 4}),
                file("sample", "kick.wav", "audio/wav", new byte[]{1, 2, 3, 4, 5})
        );

        assertEquals(7L, response.getId());
        assertEquals(42L, response.getOwnerId());
        assertEquals("Frozen Lead", response.getTitle());
        assertEquals("user_uploads/42/midi.mid", response.getMidiObjectKey());
        assertEquals("https://cdn.example.com/user_uploads/42/midi.mid", response.getMidiUrl());
        assertEquals("user_uploads/42/kick.wav", response.getSampleObjectKey());
        assertEquals("https://cdn.example.com/user_uploads/42/kick.wav", response.getSampleUrl());
        assertEquals(UploadVisibility.UNLISTED, response.getVisibility());
        assertNotNull(response.getUploadedAt());
        assertEquals("lead.mid", response.getMetadata().get("midiOriginalFilename"));
        assertEquals("audio/midi", response.getMetadata().get("midiContentType"));
        assertEquals(4L, response.getMetadata().get("midiSizeBytes"));
        assertEquals("kick.wav", response.getMetadata().get("sampleOriginalFilename"));

        ArgumentCaptor<UserUploadedProject> projectCaptor = ArgumentCaptor.forClass(UserUploadedProject.class);
        verify(projectRepository).save(projectCaptor.capture());
        UserUploadedProject saved = projectCaptor.getValue();
        assertEquals(owner, saved.getOwner());
        assertEquals("Frozen Lead", saved.getTitle());
        assertEquals(UploadVisibility.UNLISTED, saved.getVisibility());
    }

    @Test
    void invalidMidiExtensionIsRejectedBeforeStorageUpload() throws Exception {
        UploadValidationException exception = assertThrows(UploadValidationException.class, () -> service.uploadProject(
                owner,
                "Frozen Lead",
                "PRIVATE",
                file("midi", "lead.txt", "audio/midi", new byte[]{1}),
                file("sample", "kick.wav", "audio/wav", new byte[]{1})
        ));

        assertEquals("MIDI file must use .mid extension.", exception.getMessage());
        verify(storageService, never()).upload(any(), any(), any(), anyLong(), any(InputStream.class));
        verify(projectRepository, never()).save(any());
    }

    @Test
    void invalidSampleMimeTypeIsRejectedBeforeStorageUpload() throws Exception {
        UploadValidationException exception = assertThrows(UploadValidationException.class, () -> service.uploadProject(
                owner,
                "Frozen Lead",
                "PRIVATE",
                file("midi", "lead.mid", "audio/midi", new byte[]{1}),
                file("sample", "kick.wav", "text/plain", new byte[]{1})
        ));

        assertEquals("Sample file type is not supported.", exception.getMessage());
        verify(storageService, never()).upload(any(), any(), any(), anyLong(), any(InputStream.class));
        verify(projectRepository, never()).save(any());
    }

    @Test
    void oversizedSampleIsRejectedBeforeStorageUpload() throws Exception {
        UploadValidationException exception = assertThrows(UploadValidationException.class, () -> service.uploadProject(
                owner,
                "Frozen Lead",
                "PRIVATE",
                file("midi", "lead.mid", "audio/midi", new byte[]{1}),
                file("sample", "kick.wav", "audio/wav", new byte[21])
        ));

        assertEquals("Sample file is too large.", exception.getMessage());
        verify(storageService, never()).upload(any(), any(), any(), anyLong(), any(InputStream.class));
        verify(projectRepository, never()).save(any());
    }

    @Test
    void blankTitleIsRejectedBeforeStorageUpload() throws Exception {
        UploadValidationException exception = assertThrows(UploadValidationException.class, () -> service.uploadProject(
                owner,
                "   ",
                "PRIVATE",
                file("midi", "lead.mid", "audio/midi", new byte[]{1}),
                file("sample", "kick.wav", "audio/wav", new byte[]{1})
        ));

        assertEquals("Project title is required.", exception.getMessage());
        verify(storageService, never()).upload(any(), any(), any(), anyLong(), any(InputStream.class));
        verify(projectRepository, never()).save(any());
    }

    @Test
    void invalidVisibilityIsRejectedBeforeStorageUpload() throws Exception {
        UploadValidationException exception = assertThrows(UploadValidationException.class, () -> service.uploadProject(
                owner,
                "Frozen Lead",
                "FRIENDS_ONLY",
                file("midi", "lead.mid", "audio/midi", new byte[]{1}),
                file("sample", "kick.wav", "audio/wav", new byte[]{1})
        ));

        assertEquals("Visibility must be PRIVATE, UNLISTED, or PUBLIC.", exception.getMessage());
        verify(storageService, never()).upload(any(), any(), any(), anyLong(), any(InputStream.class));
        verify(projectRepository, never()).save(any());
    }

    private MockMultipartFile file(String name, String filename, String contentType, byte[] content) {
        return new MockMultipartFile(name, filename, contentType, content);
    }
}
