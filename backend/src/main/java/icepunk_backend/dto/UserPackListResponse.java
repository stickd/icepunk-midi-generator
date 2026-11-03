package icepunk_backend.dto;

import java.util.List;

public record UserPackListResponse(
        List<UserPackItem> items,
        int page,
        int size,
        long totalItems,
        int totalPages,
        boolean hasNext
) {
}
