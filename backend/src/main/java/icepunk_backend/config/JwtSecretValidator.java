package icepunk_backend.config;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;

/** Refuses known/default secrets only when the production profile is active. */
@Component
public class JwtSecretValidator {
    private static final Set<String> OBVIOUS_PLACEHOLDERS = Set.of(
            "changeme", "secret", "password", "minioadmin", "icepunk_local_dev");

    private final Environment environment;
    private final String jwtSecret;
    private final String databasePassword;
    private final String s3AccessKey;
    private final String s3SecretKey;
    private final boolean emailVerificationAutoVerify;

    public JwtSecretValidator(
            Environment environment,
            @Value("${jwt.secret:}") String jwtSecret,
            @Value("${spring.datasource.password:}") String databasePassword,
            @Value("${s3.access-key:}") String s3AccessKey,
            @Value("${s3.secret-key:}") String s3SecretKey,
            @Value("${email.verification.auto-verify:false}") boolean emailVerificationAutoVerify
    ) {
        this.environment = environment;
        this.jwtSecret = jwtSecret;
        this.databasePassword = databasePassword;
        this.s3AccessKey = s3AccessKey;
        this.s3SecretKey = s3SecretKey;
        this.emailVerificationAutoVerify = emailVerificationAutoVerify;
    }

    @PostConstruct
    void validate() {
        if (!Arrays.asList(environment.getActiveProfiles()).contains("prod")) return;
        if (isUnsafe(jwtSecret, 32)) {
            throw new IllegalStateException("JWT_SECRET must contain at least 32 random bytes in production.");
        }
        if (isUnsafe(databasePassword, 16)) {
            throw new IllegalStateException("SPRING_DATASOURCE_PASSWORD must be a non-placeholder secret of at least 16 characters in production.");
        }
        if (isUnsafe(s3AccessKey, 8) || isUnsafe(s3SecretKey, 16)) {
            throw new IllegalStateException("S3 application credentials must be non-placeholder production credentials.");
        }
        if (emailVerificationAutoVerify) {
            throw new IllegalStateException("EMAIL_VERIFICATION_AUTO_VERIFY must be disabled in production.");
        }
    }

    private boolean isUnsafe(String value, int minimumBytes) {
        if (value == null || value.isBlank() || value.getBytes(StandardCharsets.UTF_8).length < minimumBytes) return true;
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        return OBVIOUS_PLACEHOLDERS.contains(normalized)
                || normalized.startsWith("replace-with-")
                || normalized.startsWith("test-")
                || normalized.contains("your-")
                || (normalized.startsWith("<") && normalized.endsWith(">"));
    }
}
