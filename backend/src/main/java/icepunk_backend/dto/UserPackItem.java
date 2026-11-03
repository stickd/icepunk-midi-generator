package icepunk_backend.dto;

import java.time.OffsetDateTime;
import java.util.Map;

public record UserPackItem(
        Long id,
        Long ownerId,
        String ownerUsername,
        String title,
        String midiUrl,
        String sampleUrl,
        OffsetDateTime uploadedAt,
        Map<String, Object> metadata,
        long downloadCount,
        long likeCount,
        boolean likedByViewer
) {
}
