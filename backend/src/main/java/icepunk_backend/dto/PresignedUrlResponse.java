package icepunk_backend.dto;

import java.time.OffsetDateTime;

public record PresignedUrlResponse(String url, OffsetDateTime expiresAt) {
}
