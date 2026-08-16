package icepunk_backend.controller;

import icepunk_backend.dto.TempAnalysisResponse;
import icepunk_backend.exception.GenerationRequestException;
import icepunk_backend.service.TempAnalysisService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DatasetControllerTest {

    private TempAnalysisService tempAnalysisService;
    private DatasetController controller;

    @BeforeEach
    void setUp() {
        tempAnalysisService = mock(TempAnalysisService.class);
        controller = new DatasetController(tempAnalysisService);
    }

    @Test
    void analyzeTempReturnsCreatedWithServiceResponse() throws Exception {
        List<org.springframework.web.multipart.MultipartFile> files = List.of(
                new MockMultipartFile("files", "loop.mid", "audio/midi", new byte[]{1, 2, 3})
        );
        TempAnalysisResponse serviceResponse = new TempAnalysisResponse("temp-id", 1, Map.of());
        when(tempAnalysisService.analyzeTemp(files)).thenReturn(serviceResponse);

        ResponseEntity<TempAnalysisResponse> response = controller.analyzeTemp(files);

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertEquals(serviceResponse, response.getBody());
    }

    @Test
    void analyzeTempPropagatesValidationFailureFromService() throws Exception {
        List<org.springframework.web.multipart.MultipartFile> files = List.of();
        when(tempAnalysisService.analyzeTemp(files))
                .thenThrow(new GenerationRequestException("Upload at least one MIDI file."));

        assertThrows(GenerationRequestException.class, () -> controller.analyzeTemp(files));
    }
}
