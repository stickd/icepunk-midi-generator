package icepunk_backend.service;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * Delivers no mail when an explicitly non-production environment needs to exercise
 * registration without calling an external mail provider. It deliberately neither
 * persists nor logs the raw verification token.
 */
@Service
@ConditionalOnProperty(name = "email.delivery.mode", havingValue = "noop")
public class NoopEmailService implements EmailService {
    @Override
    public void sendVerificationEmail(String email, String rawToken) {
        // Intentionally empty: this adapter is enabled only by explicit test configuration.
    }
}
