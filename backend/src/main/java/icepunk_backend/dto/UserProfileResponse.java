package icepunk_backend.dto;

import java.time.OffsetDateTime;

public record UserProfileResponse(
        Long id,
        String username,
        String bio,
        boolean verified,
        OffsetDateTime joinedAt,
        long packCount,
        long totalDownloads,
        long totalLikes
) {
}
