package icepunk_backend.dto;

import java.util.Map;

public record TempAnalysisResponse(
        String tempAnalysisId,
        int fileCount,
        Map<String, Object> metadata
) {
}
