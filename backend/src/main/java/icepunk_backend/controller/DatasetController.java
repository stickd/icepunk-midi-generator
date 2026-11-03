package icepunk_backend.controller;

import icepunk_backend.dto.TempAnalysisResponse;
import icepunk_backend.service.TempAnalysisService;
import icepunk_backend.model.User;
import icepunk_backend.repository.UserRepository;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.beans.factory.annotation.Autowired;
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
    private final UserRepository userRepository;

    @Autowired
    public DatasetController(TempAnalysisService tempAnalysisService, UserRepository userRepository) {
        this.tempAnalysisService = tempAnalysisService;
        this.userRepository = userRepository;
    }

    public DatasetController(TempAnalysisService tempAnalysisService) {
        this(tempAnalysisService, null);
    }

    @PostMapping("/datasets/analyze-temp")
    public ResponseEntity<TempAnalysisResponse> analyzeTemp(
            @RequestParam("files") List<MultipartFile> files,
            Authentication authentication
    ) throws IOException {
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(tempAnalysisService.analyzeTemp(files, currentUserOrNull(authentication)));
    }

    public ResponseEntity<TempAnalysisResponse> analyzeTemp(List<MultipartFile> files) throws IOException {
        return ResponseEntity.status(HttpStatus.CREATED).body(tempAnalysisService.analyzeTemp(files));
    }

    private User currentUserOrNull(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated() || authentication instanceof AnonymousAuthenticationToken) return null;
        return userRepository == null ? null : userRepository.findByEmail(authentication.getName()).orElse(null);
    }
}
