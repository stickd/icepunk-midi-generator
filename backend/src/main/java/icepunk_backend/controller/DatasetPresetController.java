package icepunk_backend.controller;

import icepunk_backend.dto.DatasetPresetResponse;
import icepunk_backend.dto.SaveDatasetPresetRequest;
import icepunk_backend.model.User;
import icepunk_backend.repository.UserRepository;
import icepunk_backend.service.DatasetPresetService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
public class DatasetPresetController {

    private final DatasetPresetService datasetPresetService;
    private final UserRepository userRepository;

    public DatasetPresetController(DatasetPresetService datasetPresetService, UserRepository userRepository) {
        this.datasetPresetService = datasetPresetService;
        this.userRepository = userRepository;
    }

    @PostMapping("/datasets")
    public ResponseEntity<DatasetPresetResponse> save(
            Authentication authentication,
            @Valid @RequestBody SaveDatasetPresetRequest request
    ) {
        DatasetPresetResponse response = datasetPresetService.save(
                currentUser(authentication),
                request.name(),
                request.tempAnalysisId(),
                request.tempAnalysisAccessToken()
        );

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/datasets")
    public List<DatasetPresetResponse> list(Authentication authentication) {
        return datasetPresetService.list(currentUser(authentication));
    }

    @DeleteMapping("/datasets/{id}")
    public ResponseEntity<Void> delete(Authentication authentication, @PathVariable UUID id) {
        datasetPresetService.delete(id, currentUser(authentication));
        return ResponseEntity.noContent().build();
    }

    private User currentUser(Authentication authentication) {
        return userRepository.findByEmail(authentication.getName()).orElseThrow();
    }
}
