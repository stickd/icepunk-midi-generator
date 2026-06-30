package icepunk_backend.service;

import icepunk_backend.dto.LoginRequest;
import icepunk_backend.dto.RegisterRequest;
import icepunk_backend.exception.EmailAlreadyExistsException;
import icepunk_backend.exception.InvalidCredentialsException;
import icepunk_backend.exception.UsernameAlreadyExistsException;
import icepunk_backend.model.User;
import icepunk_backend.repository.UserRepository;
import icepunk_backend.security.JwtService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Locale;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    public String register(RegisterRequest request) {
        String email = normalizeEmail(request.getEmail());
        String username = request.getUsername().trim();

        log.info("Registration attempt for email={}", email);

        if (userRepository.existsByEmail(email)) {
            log.warn("Registration rejected: email already exists email={}", email);
            throw new EmailAlreadyExistsException("Email already exists");
        }

        if (userRepository.existsByUsername(username)) {
            log.warn("Registration rejected: username already exists username={}", username);
            throw new UsernameAlreadyExistsException("Username already exists");
        }

        String passwordHash = passwordEncoder.encode(request.getPassword());

        User user = new User(
                username,
                email,
                passwordHash
        );

        User savedUser = userRepository.save(user);

        log.info("Registration succeeded for email={}", savedUser.getEmail());
        return jwtService.generateToken(savedUser.getEmail());
    }

    public String login(LoginRequest request) {
        String email = normalizeEmail(request.getEmail());

        log.info("Login attempt for email={}", email);

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> {
                    log.warn("Login rejected: unknown email={}", email);
                    return new InvalidCredentialsException("Invalid email or password");
                });

        boolean passwordMatches = passwordEncoder.matches(
                request.getPassword(),
                user.getPasswordHash()
        );

        if (!passwordMatches) {
            log.warn("Login rejected: bad password for email={}", email);
            throw new InvalidCredentialsException("Invalid email or password");
        }

        log.info("Login succeeded for email={}", email);
        return jwtService.generateToken(user.getEmail());
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
