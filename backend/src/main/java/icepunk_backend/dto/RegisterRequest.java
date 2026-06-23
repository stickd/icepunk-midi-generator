package icepunk_backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class RegisterRequest {

    @NotBlank
    @Size(max = 40)
    private String username;

    @Email
    @NotBlank
    @Size(max = 254)
    private String email;

    @NotBlank
    @Size(min = 6, max = 128)
    private String password;

    public String getUsername() {
        return username;
    }

    public String getEmail() {
        return email;
    }

    public String getPassword() {
        return password;
    }
}
