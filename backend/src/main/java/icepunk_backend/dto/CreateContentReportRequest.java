package icepunk_backend.dto; import jakarta.validation.constraints.*;
public record CreateContentReportRequest(@NotBlank String targetType,@NotBlank String targetId,@NotBlank String category,@Size(max=2000) String description){}
