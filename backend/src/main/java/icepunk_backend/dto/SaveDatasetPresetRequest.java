package icepunk_backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SaveDatasetPresetRequest(
        @NotBlank(message = "Name is required")
        @Size(max = 100, message = "Name must be 100 characters or less")
        String name,

        @NotBlank(message = "tempAnalysisId is required")
        String tempAnalysisId
) {
}
