package icepunk_backend.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record GeneratedPackResponse(
        UUID packId,
        String name,
        String source,
        String type,
        Integer bpm,
        Integer pitch,
        Integer octaves,
        Integer amount,
        OffsetDateTime createdAt,
        String packDownloadUrl,
        List<GeneratedMidiItemResponse> items
) {
}
