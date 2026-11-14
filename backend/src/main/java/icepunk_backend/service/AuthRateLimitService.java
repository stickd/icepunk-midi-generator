package icepunk_backend.service;

import icepunk_backend.exception.RateLimitException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;

/**
 * Shared, fixed-window authentication rate limiter. Values are deliberately
 * fingerprinted before becoming Redis keys so email addresses are not stored
 * in the rate-limit data store. Redis errors fail closed.
 */
@Service
public class AuthRateLimitService {

    private static final DefaultRedisScript<Long> INCREMENT_WITH_EXPIRY = new DefaultRedisScript<>(
            "local current = redis.call('INCR', KEYS[1]); "
                    + "if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; "
                    + "return current;",
            Long.class
    );

    private final StringRedisTemplate redis;
    private final int loginIpLimit;
    private final int loginIdentifierLimit;
    private final Duration loginWindow;
    private final int registerIpLimit;
    private final int registerEmailLimit;
    private final Duration registerWindow;
    private final int resendLimit;
    private final Duration resendWindow;

    public AuthRateLimitService(
            StringRedisTemplate redis,
            @Value("${auth.rate-limit.login-ip-limit}") int loginIpLimit,
            @Value("${auth.rate-limit.login-identifier-limit}") int loginIdentifierLimit,
            @Value("${auth.rate-limit.login-window-seconds}") long loginWindowSeconds,
            @Value("${auth.rate-limit.register-ip-limit}") int registerIpLimit,
            @Value("${auth.rate-limit.register-email-limit}") int registerEmailLimit,
            @Value("${auth.rate-limit.register-window-seconds}") long registerWindowSeconds,
            @Value("${email.verification.resend-limit}") int resendLimit,
            @Value("${email.verification.resend-window-minutes}") long resendWindowMinutes
    ) {
        this.redis = redis;
        this.loginIpLimit = positive(loginIpLimit, "login IP limit");
        this.loginIdentifierLimit = positive(loginIdentifierLimit, "login identifier limit");
        this.loginWindow = Duration.ofSeconds(positive(loginWindowSeconds, "login window"));
        this.registerIpLimit = positive(registerIpLimit, "registration IP limit");
        this.registerEmailLimit = positive(registerEmailLimit, "registration email limit");
        this.registerWindow = Duration.ofSeconds(positive(registerWindowSeconds, "registration window"));
        this.resendLimit = positive(resendLimit, "resend limit");
        this.resendWindow = Duration.ofMinutes(positive(resendWindowMinutes, "resend window"));
    }

    public void checkRegisterLimit(String ipAddress, String email) {
        check("register:ip:" + fingerprint(ipAddress), registerIpLimit, registerWindow,
                "Too many registration attempts. Try again later.");
        check("register:email:" + fingerprint(email), registerEmailLimit, registerWindow,
                "Too many registration attempts. Try again later.");
    }

    public void checkLoginLimit(String ipAddress, String identifier) {
        check("login:ip:" + fingerprint(ipAddress), loginIpLimit, loginWindow,
                "Too many login attempts. Try again later.");
        check("login:identifier:" + fingerprint(identifier), loginIdentifierLimit, loginWindow,
                "Too many login attempts. Try again later.");
    }

    public void checkResendVerificationLimit(String ipAddress, String email) {
        check("verify-resend:ip:" + fingerprint(ipAddress), resendLimit, resendWindow,
                "Too many verification requests. Try again later.");
        check("verify-resend:email:" + fingerprint(email), resendLimit, resendWindow,
                "Too many verification requests. Try again later.");
    }

    public void checkReportLimit(Long userId) {
        check("reports:user:" + fingerprint(userId.toString()), 10, Duration.ofHours(1), "Too many reports. Try again later.");
    }
    public void checkAnonymousReportLimit(String ipAddress) {
        check("reports:ip:" + fingerprint(ipAddress), 10, Duration.ofHours(1), "Too many reports. Try again later.");
    }

    private void check(String key, int limit, Duration window, String message) {
        try {
            Long attempts = redis.execute(INCREMENT_WITH_EXPIRY, List.of(key), Long.toString(window.toSeconds()));
            if (attempts == null) {
                throw new RateLimitException("Authentication requests are temporarily unavailable. Please try again later.", 60);
            }
            if (attempts > limit) {
                Long ttl = redis.getExpire(key);
                throw new RateLimitException(message, ttl == null || ttl < 1 ? window.toSeconds() : ttl);
            }
        } catch (RateLimitException exception) {
            throw exception;
        } catch (DataAccessException exception) {
            throw new RateLimitException("Authentication requests are temporarily unavailable. Please try again later.", 60);
        }
    }

    static String fingerprint(String value) {
        try {
            String normalized = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(normalized.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private static int positive(long value, String label) {
        if (value < 1 || value > Integer.MAX_VALUE) {
            throw new IllegalArgumentException(label + " must be positive");
        }
        return (int) value;
    }
}
