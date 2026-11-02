package icepunk_backend.dto;

public class AuthResponse {
    private String token;
    private boolean verificationRequired;

    public AuthResponse(String token) {
        this.token = token;
    }

    public AuthResponse(String token, boolean verificationRequired) {
        this.token = token;
        this.verificationRequired = verificationRequired;
    }

    public String getToken() {
        return token;
    }

    public boolean isVerificationRequired() {
        return verificationRequired;
    }
}
