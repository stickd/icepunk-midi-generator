package icepunk_backend.service;

import icepunk_backend.dto.LoginRequest;
import icepunk_backend.dto.RegisterRequest;
import icepunk_backend.exception.InvalidCredentialsException;
import icepunk_backend.exception.EmailNotVerifiedException;
import icepunk_backend.model.User;
import icepunk_backend.repository.UserRepository;
import icepunk_backend.repository.UserLegalAcceptanceRepository;
import icepunk_backend.model.UserLegalAcceptance;
import icepunk_backend.security.JwtService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.Locale;
import java.util.Optional;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final EmailVerificationService emailVerificationService;
    private final UserLegalAcceptanceRepository legalAcceptances;
    public static final String TERMS_VERSION = "1.0";

    @Autowired
    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService, EmailVerificationService emailVerificationService, UserLegalAcceptanceRepository legalAcceptances
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.emailVerificationService = emailVerificationService;
        this.legalAcceptances = legalAcceptances;
    }

    /** Compatibility constructor for focused unit tests. */
    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService, EmailVerificationService emailVerificationService) {
        this(userRepository, passwordEncoder, jwtService, emailVerificationService, null);
    }

    public String register(RegisterRequest request) {
        if (!request.isTermsAccepted()) throw new IllegalArgumentException("Terms acceptance is required.");
        String email = normalizeEmail(request.getEmail());
        String maskedEmail = maskEmailForLogs(email);
        String username = request.getUsername().trim();

        log.info("Registration attempt for email={}", maskedEmail);

        if (userRepository.existsByEmail(email)) {
            Optional<User> existingUser = userRepository.findByEmail(email);
            if (existingUser.isPresent() && !Boolean.TRUE.equals(existingUser.get().getVerified())) {
                // A delivery outage must not strand an account created moments earlier.
                // Re-registration is deliberately treated as a verification recovery flow.
                emailVerificationService.createAndSend(existingUser.get());
                log.info("Registration recovery email requested for email={}", maskedEmail);
            }
            // Keep registration indistinguishable for verified users too.
            return null;
        }

        if (userRepository.existsByUsername(username)) {
            // Deliberately do not reveal username ownership to unauthenticated callers.
            return null;
        }

        String passwordHash = passwordEncoder.encode(request.getPassword());

        User user = new User(
                username,
                email,
                passwordHash
        );

        user.setVerified(false);
        User savedUser = userRepository.save(user);
        if (legalAcceptances != null) legalAcceptances.save(new UserLegalAcceptance(savedUser, "TERMS", TERMS_VERSION));
        emailVerificationService.createAndSend(savedUser);

        log.info("Registration succeeded for email={}", maskEmailForLogs(savedUser.getEmail()));
        return null;
    }

    public String login(LoginRequest request) {
        String identifier = request.getIdentifier().trim();
        String maskedIdentifier = maskEmailForLogs(identifier);

        log.info("Login attempt for identifier={}", maskedIdentifier);

        User user = resolveUserByIdentifier(identifier)
                .orElseThrow(() -> {
                    log.warn("Login rejected: unknown identifier={}", maskedIdentifier);
                    return new InvalidCredentialsException("Invalid credentials");
                });

        boolean passwordMatches = passwordEncoder.matches(
                request.getPassword(),
                user.getPasswordHash()
        );

        if (!passwordMatches || !user.isActive()) {
            log.warn("Login rejected: bad password for identifier={}", maskedIdentifier);
            throw new InvalidCredentialsException("Invalid credentials");
        }

        if (!Boolean.TRUE.equals(user.getVerified())) throw new EmailNotVerifiedException();

        log.info("Login succeeded for email={}", maskEmailForLogs(user.getEmail()));
        return jwtService.generateToken(user.getEmail());
    }

    private Optional<User> resolveUserByIdentifier(String identifier) {
        return userRepository.findByEmail(normalizeEmail(identifier))
                .or(() -> userRepository.findByUsernameIgnoreCase(identifier));
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    static String maskEmailForLogs(String email) {
        if (email == null || email.isBlank()) {
            return "***";
        }

        String normalized = email.trim().toLowerCase(Locale.ROOT);
        int atIndex = normalized.indexOf('@');
        String localPart = atIndex > 0 ? normalized.substring(0, atIndex) : normalized;
        String domainPart = atIndex >= 0 ? normalized.substring(atIndex) : "";

        if (localPart.isEmpty()) {
            return "***" + domainPart;
        }

        return localPart.charAt(0) + "***" + domainPart;
    }
}
