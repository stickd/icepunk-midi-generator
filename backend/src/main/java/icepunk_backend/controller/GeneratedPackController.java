package icepunk_backend.controller;

import icepunk_backend.dto.GeneratedPackResponse;
import icepunk_backend.service.GeneratedPackService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.UUID;

@RestController
public class GeneratedPackController {

    private final GeneratedPackService generatedPackService;

    public GeneratedPackController(GeneratedPackService generatedPackService) {
        this.generatedPackService = generatedPackService;
    }

    @GetMapping("/generated-packs/{packId}")
    public ResponseEntity<GeneratedPackResponse> getPack(@PathVariable UUID packId) {
        return generatedPackService.getPack(packId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/generated-packs/{packId}/download")
    public ResponseEntity<Void> downloadPack(@PathVariable UUID packId) {
        return generatedPackService.getPackDownloadUrl(packId)
                .map(url -> ResponseEntity.status(302)
                        .header(HttpHeaders.LOCATION, URI.create(url).toString())
                        .<Void>build())
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/generated-packs/{packId}/items/{itemId}/download")
    public ResponseEntity<Void> downloadItem(@PathVariable UUID packId, @PathVariable UUID itemId) {
        return generatedPackService.getItemDownloadUrl(packId, itemId)
                .map(url -> ResponseEntity.status(302)
                        .header(HttpHeaders.LOCATION, URI.create(url).toString())
                        .<Void>build())
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
