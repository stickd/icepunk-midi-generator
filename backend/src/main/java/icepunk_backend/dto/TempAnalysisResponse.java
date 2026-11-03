package icepunk_backend.dto;

import java.util.Map;

public record TempAnalysisResponse(
        String tempAnalysisId,
        String accessToken,
        int fileCount,
        Map<String, Object> metadata
) {
    public TempAnalysisResponse(String tempAnalysisId, int fileCount, Map<String, Object> metadata) {
        this(tempAnalysisId, null, fileCount, metadata);
    }
}
