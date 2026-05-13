package icepunk_backend.controller;

import icepunk_backend.service.MidiGenerationService;

import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.file.Path;

@RestController
@CrossOrigin(origins = "http://localhost:3000")
public class GenerateController {

    private final MidiGenerationService midiGenerationService;

    public GenerateController(MidiGenerationService midiGenerationService) {
        this.midiGenerationService = midiGenerationService;
    }

    @GetMapping("/generate")
    public ResponseEntity<Resource> generate() throws Exception {

        Path zipPath = midiGenerationService.generateZip();

        Resource resource = new FileSystemResource(zipPath);

        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"icepunk-midi-pack.zip\""
                )
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(resource);
    }
}