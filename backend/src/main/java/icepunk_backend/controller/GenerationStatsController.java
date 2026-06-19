package icepunk_backend.controller;

import icepunk_backend.service.GenerationStatsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class GenerationStatsController {

    private final GenerationStatsService generationStatsService;

    public GenerationStatsController(GenerationStatsService generationStatsService) {
        this.generationStatsService = generationStatsService;
    }

    @GetMapping("/generation-stats")
    public ResponseEntity<GenerationStatsResponse> getGenerationStats() {
        return ResponseEntity.ok(
                new GenerationStatsResponse(generationStatsService.getTotalGenerations())
        );
    }

    public static class GenerationStatsResponse {

        private final long totalGenerations;

        public GenerationStatsResponse(long totalGenerations) {
            this.totalGenerations = totalGenerations;
        }

        public long getTotalGenerations() {
            return totalGenerations;
        }
    }
}
