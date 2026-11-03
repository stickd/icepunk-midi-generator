package icepunk_backend.dto;

public record LikeResponse(
        Long projectId,
        boolean liked,
        long likeCount
) {
}
