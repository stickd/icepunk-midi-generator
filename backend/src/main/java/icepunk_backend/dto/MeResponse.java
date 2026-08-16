package icepunk_backend.dto;

import java.time.OffsetDateTime;

public record MeResponse(
        Long id,
        String username,
        String email,
        String bio,
        String profilePictureUrl,
        int credits,
        boolean verified,
        OffsetDateTime joinedAt
) {
}
