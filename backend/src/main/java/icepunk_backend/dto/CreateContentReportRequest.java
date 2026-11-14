package icepunk_backend.dto;
import jakarta.validation.constraints.*;
public record CreateContentReportRequest(
        @NotBlank String targetType,
        @NotBlank String targetId,
        @NotBlank String category,
        @Size(max=2000) String description,
        @NotBlank @Pattern(regexp="FORMAL_DSA|COMMUNITY") String noticeType,
        @Size(max=160) String reporterName,
        @Email @Size(max=320) String contactEmail,
        @NotNull Boolean goodFaith) {}
