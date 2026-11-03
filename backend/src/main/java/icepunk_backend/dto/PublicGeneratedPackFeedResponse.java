package icepunk_backend.dto;

import java.util.List;

public record PublicGeneratedPackFeedResponse(
        List<PublicGeneratedPackFeedItem> items,
        int page,
        int size,
        long totalItems,
        int totalPages,
        boolean hasNext
) {
}
