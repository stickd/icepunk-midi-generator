package icepunk_backend.dto;

import icepunk_backend.model.GeneratedPackVisibility;
import jakarta.validation.constraints.NotNull;

public record UpdateGeneratedPackVisibilityRequest(
        @NotNull(message = "Visibility is required")
        GeneratedPackVisibility visibility
) {
}
