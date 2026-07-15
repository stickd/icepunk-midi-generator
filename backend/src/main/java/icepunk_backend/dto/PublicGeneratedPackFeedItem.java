package icepunk_backend.dto;

import icepunk_backend.model.GeneratedPackVisibility;
import com.fasterxml.jackson.annotation.JsonIgnore;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record PublicGeneratedPackFeedItem(
        UUID packId,
        String name,
        Long ownerId,
        String ownerUsername,
        String source,
        String type,
        Integer bpm,
        Integer pitch,
        Integer octaves,
        Integer amount,
        OffsetDateTime createdAt,
        GeneratedPackVisibility visibility,
        @JsonIgnore String packDownloadUrl,
        List<GeneratedMidiItemResponse> items
) {
}
