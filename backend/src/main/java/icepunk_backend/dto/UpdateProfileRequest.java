package icepunk_backend.dto;

import jakarta.validation.constraints.Size;

public record UpdateProfileRequest(
        @Size(max = 300, message = "Bio must be 300 characters or less")
        String bio,
        @Size(max = 1024, message = "Profile picture URL must be 1024 characters or less")
        String profilePictureUrl
) {
}
