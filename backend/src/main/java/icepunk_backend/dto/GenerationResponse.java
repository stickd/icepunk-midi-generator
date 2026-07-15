package icepunk_backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record GenerationResponse(
        UUID packId,
        String name,
        String source,
        String type,
        Integer bpm,
        Integer pitch,
        Integer octaves,
        Integer amount,
        OffsetDateTime createdAt,
        @JsonIgnore String packDownloadUrl,
        @JsonIgnore String downloadUrl,
        long totalGenerations,
        List<GeneratedMidiItemResponse> items
) {
}
