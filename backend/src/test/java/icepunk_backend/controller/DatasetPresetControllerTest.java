package icepunk_backend.controller;

import icepunk_backend.dto.DatasetPresetResponse;
import icepunk_backend.dto.SaveDatasetPresetRequest;
import icepunk_backend.exception.ForbiddenActionException;
import icepunk_backend.model.User;
import icepunk_backend.repository.UserRepository;
import icepunk_backend.service.DatasetPresetService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DatasetPresetControllerTest {

    private DatasetPresetService datasetPresetService;
    private UserRepository userRepository;
    private DatasetPresetController controller;

    private User testUser;
    private UsernamePasswordAuthenticationToken auth;

    @BeforeEach
    void setUp() {
        datasetPresetService = mock(DatasetPresetService.class);
        userRepository = mock(UserRepository.class);
        controller = new DatasetPresetController(datasetPresetService, userRepository);

        testUser = new User("maco", "maco@example.com", "hash");
        testUser.setId(10L);
        auth = new UsernamePasswordAuthenticationToken("maco@example.com", null);
        when(userRepository.findByEmail("maco@example.com")).thenReturn(Optional.of(testUser));
    }

    @Test
    void saveResolvesCallerAndReturnsCreated() {
        SaveDatasetPresetRequest request = new SaveDatasetPresetRequest("My Loops", "temp-id");
        DatasetPresetResponse serviceResponse = new DatasetPresetResponse(
                UUID.randomUUID(), "My Loops", 4, OffsetDateTime.now()
        );
        when(datasetPresetService.save(testUser, "My Loops", "temp-id", null)).thenReturn(serviceResponse);

        ResponseEntity<DatasetPresetResponse> response = controller.save(auth, request);

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertEquals(serviceResponse, response.getBody());
    }

    @Test
    void listResolvesCallerAndReturnsPresets() {
        DatasetPresetResponse preset = new DatasetPresetResponse(UUID.randomUUID(), "Loops", 3, OffsetDateTime.now());
        when(datasetPresetService.list(testUser)).thenReturn(List.of(preset));

        List<DatasetPresetResponse> response = controller.list(auth);

        assertEquals(List.of(preset), response);
    }

    @Test
    void deleteResolvesCallerAndReturnsNoContent() {
        UUID presetId = UUID.randomUUID();

        ResponseEntity<Void> response = controller.delete(auth, presetId);

        assertEquals(HttpStatus.NO_CONTENT, response.getStatusCode());
        verify(datasetPresetService).delete(presetId, testUser);
    }

    @Test
    void deletePropagatesForbiddenWhenCallerDoesNotOwnPreset() {
        UUID presetId = UUID.randomUUID();
        org.mockito.Mockito.doThrow(new ForbiddenActionException("You do not own this dataset."))
                .when(datasetPresetService).delete(presetId, testUser);

        assertThrows(ForbiddenActionException.class, () -> controller.delete(auth, presetId));
    }
}
