package icepunk_backend.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record DatasetPresetResponse(
        UUID id,
        String name,
        Integer sourceMidiCount,
        OffsetDateTime createdAt
) {
}
