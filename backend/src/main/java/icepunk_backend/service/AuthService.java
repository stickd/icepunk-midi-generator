package icepunk_backend.service;

import icepunk_backend.dto.LoginRequest;
import icepunk_backend.dto.RegisterRequest;
import icepunk_backend.exception.EmailAlreadyExistsException;
import icepunk_backend.exception.InvalidCredentialsException;
import icepunk_backend.exception.UsernameAlreadyExistsException;
import icepunk_backend.model.User;
import icepunk_backend.repository.UserRepository;
import icepunk_backend.security.JwtService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Locale;

@Service
public class AuthService {

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

        if (userRepository.existsByEmail(email)) {
            throw new EmailAlreadyExistsException("Email already exists");
        }

        if (userRepository.existsByUsername(username)) {
            throw new UsernameAlreadyExistsException("Username already exists");
        }

        String passwordHash = passwordEncoder.encode(request.getPassword());

        User user = new User(
                username,
                email,
                passwordHash
        );

        User savedUser = userRepository.save(user);

        return jwtService.generateToken(savedUser.getEmail());
    }

    public String login(LoginRequest request) {
        String email = normalizeEmail(request.getEmail());

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new InvalidCredentialsException("Invalid email or password"));

        boolean passwordMatches = passwordEncoder.matches(
                request.getPassword(),
                user.getPasswordHash()
        );

        if (!passwordMatches) {
            throw new InvalidCredentialsException("Invalid email or password");
        }

        return jwtService.generateToken(user.getEmail());
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
