package icepunk_backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.AssertTrue;

public class RegisterRequest {

    @NotBlank
    @Size(max = 40)
    private String username;

    @Email
    @NotBlank
    @Size(max = 254)
    private String email;

    @NotBlank
    @Size(min = 12, max = 128)
    private String password;
    @AssertTrue(message = "Terms acceptance is required")
    private boolean termsAccepted;
    @AssertTrue(message = "Age confirmation is required")
    private boolean ageConfirmed;

    public String getUsername() {
        return username;
    }

    public String getEmail() {
        return email;
    }

    public String getPassword() {
        return password;
    }
    public boolean isTermsAccepted() { return termsAccepted; }
    public void setTermsAccepted(boolean termsAccepted) { this.termsAccepted = termsAccepted; }
    public boolean isAgeConfirmed() { return ageConfirmed; }
    public void setAgeConfirmed(boolean ageConfirmed) { this.ageConfirmed = ageConfirmed; }
}
