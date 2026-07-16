package icepunk_backend.config;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

/** Refuses known/default or short HMAC secrets when the prod profile is active. */
@Component
public class JwtSecretValidator {
    private final Environment environment; private final String secret;
    public JwtSecretValidator(Environment environment, @Value("${jwt.secret:}") String secret) { this.environment=environment; this.secret=secret; }
    @PostConstruct void validate() {
        if (!Arrays.asList(environment.getActiveProfiles()).contains("prod")) return;
        if (secret == null || secret.isBlank() || secret.getBytes(StandardCharsets.UTF_8).length < 32 || secret.startsWith("replace-with-") || secret.startsWith("test-secret"))
            throw new IllegalStateException("JWT_SECRET must contain at least 32 random bytes in production.");
    }
}
