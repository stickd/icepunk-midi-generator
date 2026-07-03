package icepunk_backend.controller;

import icepunk_backend.dto.TempAnalysisResponse;
import icepunk_backend.service.TempAnalysisService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@RestController
public class DatasetController {

    private final TempAnalysisService tempAnalysisService;

    public DatasetController(TempAnalysisService tempAnalysisService) {
        this.tempAnalysisService = tempAnalysisService;
    }

    @PostMapping("/datasets/analyze-temp")
    public ResponseEntity<TempAnalysisResponse> analyzeTemp(
            @RequestParam("files") List<MultipartFile> files
    ) throws IOException {
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(tempAnalysisService.analyzeTemp(files));
    }
}
