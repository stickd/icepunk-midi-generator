package icepunk_backend.service;

public interface EmailService {
    void sendVerificationEmail(String email, String rawToken);
}
