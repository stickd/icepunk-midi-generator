package icepunk_backend.service;

import icepunk_backend.model.EmailVerificationToken;
import icepunk_backend.model.User;
import icepunk_backend.repository.EmailVerificationTokenRepository;
import icepunk_backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.scheduling.annotation.Scheduled;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.Locale;

@Service
public class EmailVerificationService {
    public enum Result { VERIFIED, INVALID, EXPIRED, ALREADY_USED }
    private final EmailVerificationTokenRepository tokens;
    private final UserRepository users;
    private final EmailService emailService;
    private final int expiryMinutes;
    private final int cleanupRetentionHours;
    private final boolean autoVerify;
    private final SecureRandom secureRandom = new SecureRandom();

    @Autowired
    public EmailVerificationService(EmailVerificationTokenRepository tokens, UserRepository users, EmailService emailService,
            @Value("${email.verification.expiry-minutes:60}") int expiryMinutes,
            @Value("${email.verification.cleanup-retention-hours:24}") int cleanupRetentionHours,
            @Value("${email.verification.auto-verify:false}") boolean autoVerify) {
        this.tokens = tokens; this.users = users; this.emailService = emailService; this.expiryMinutes = expiryMinutes;
        this.cleanupRetentionHours = cleanupRetentionHours;
        this.autoVerify = autoVerify;
    }

    /** Compatibility constructor retained for focused unit tests. */
    public EmailVerificationService(EmailVerificationTokenRepository tokens, UserRepository users, EmailService emailService,
            int expiryMinutes) {
        this(tokens, users, emailService, expiryMinutes, 24, false);
    }

    @Transactional
    public void createAndSend(User user) {
        OffsetDateTime now = OffsetDateTime.now();
        tokens.invalidateActiveForUser(user, now);
        byte[] bytes = new byte[32]; secureRandom.nextBytes(bytes);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        tokens.save(new EmailVerificationToken(user, hash(rawToken), now, now.plusMinutes(Math.max(1, expiryMinutes))));
        emailService.sendVerificationEmail(user.getEmail(), rawToken);
        if (autoVerify) {
            user.setVerified(true);
            tokens.invalidateActiveForUser(user, now);
        }
    }

    @Transactional
    public Result verify(String rawToken) {
        if (rawToken == null || rawToken.isBlank() || rawToken.length() > 512) return Result.INVALID;
        OffsetDateTime now = OffsetDateTime.now();
        EmailVerificationToken token = tokens.findByTokenHashForUpdate(hash(rawToken)).orElse(null);
        if (token == null) return Result.INVALID;
        if (token.getUsedAt() != null || Boolean.TRUE.equals(token.getUser().getVerified())) return Result.ALREADY_USED;
        if (!now.isBefore(token.getExpiresAt())) { token.setUsedAt(now); return Result.EXPIRED; }
        token.getUser().setVerified(true);
        token.setUsedAt(now);
        tokens.invalidateActiveForUser(token.getUser(), now);
        return Result.VERIFIED;
    }

    @Transactional
    public void resend(String email) {
        users.findByEmail(email.trim().toLowerCase(Locale.ROOT)).filter(user -> !Boolean.TRUE.equals(user.getVerified()))
                .ifPresent(this::createAndSend);
    }

    static String hash(String rawToken) {
        try { return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(rawToken.getBytes(StandardCharsets.UTF_8))); }
        catch (Exception exception) { throw new IllegalStateException("SHA-256 is unavailable", exception); }
    }

    @Scheduled(fixedDelayString = "${email.verification.cleanup-fixed-delay-ms:3600000}")
    @Transactional
    public void cleanupStaleTokens() {
        tokens.deleteExpiredOrUsedBefore(OffsetDateTime.now().minusHours(Math.max(1, cleanupRetentionHours)));
    }
}
