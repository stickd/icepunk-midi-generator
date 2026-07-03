package icepunk_backend.dto;

import jakarta.validation.constraints.Size;

public record UpdateProfileRequest(
        @Size(max = 300, message = "Bio must be 300 characters or less")
        String bio
) {
}
