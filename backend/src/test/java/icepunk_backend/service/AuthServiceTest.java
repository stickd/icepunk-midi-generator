package icepunk_backend.service;

import icepunk_backend.dto.LoginRequest;
import icepunk_backend.dto.RegisterRequest;
import icepunk_backend.exception.EmailAlreadyExistsException;
import icepunk_backend.exception.InvalidCredentialsException;
import icepunk_backend.exception.UsernameAlreadyExistsException;
import icepunk_backend.model.User;
import icepunk_backend.repository.UserRepository;
import icepunk_backend.security.JwtService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/*
 * | EP                          | Input                       | Expected                          |
 * |-----------------------------|-----------------------------|-----------------------------------|
 * | email normalization         | "  Foo@Bar.COM "            | saved email = "foo@bar.com"       |
 * | duplicate email             | existsByEmail = true        | EmailAlreadyExistsException       |
 * | duplicate username          | existsByUsername = true      | UsernameAlreadyExistsException    |
 * | password hashing            | raw password                | stored hash != raw, BCrypt match  |
 * | register success            | valid request               | returns JWT from jwtService       |
 * | login unknown email         | findByEmail empty           | InvalidCredentialsException       |
 * | login bad password          | hash mismatch               | InvalidCredentialsException       |
 * | login success               | hash match                  | returns JWT from jwtService       |
 */
class AuthServiceTest {

    private final UserRepository userRepository = mock(UserRepository.class);
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final JwtService jwtService = mock(JwtService.class);

    private final AuthService authService =
            new AuthService(userRepository, passwordEncoder, jwtService);

    private RegisterRequest registerRequest(String username, String email, String password) {
        RegisterRequest request = mock(RegisterRequest.class);
        when(request.getUsername()).thenReturn(username);
        when(request.getEmail()).thenReturn(email);
        when(request.getPassword()).thenReturn(password);
        return request;
    }

    private LoginRequest loginRequest(String email, String password) {
        LoginRequest request = mock(LoginRequest.class);
        when(request.getEmail()).thenReturn(email);
        when(request.getPassword()).thenReturn(password);
        return request;
    }

    @Test
    void registerNormalizesEmailToLowercaseAndTrimmed() {
        when(userRepository.existsByEmail("foo@bar.com")).thenReturn(false);
        when(userRepository.existsByUsername("bob")).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArgument(0));

        authService.register(registerRequest("  bob  ", "  Foo@Bar.COM ", "secret123"));

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(saved.capture());
        assertEquals("foo@bar.com", saved.getValue().getEmail());
        assertEquals("bob", saved.getValue().getUsername());
    }

    @Test
    void registerRejectsDuplicateEmail() {
        when(userRepository.existsByEmail("foo@bar.com")).thenReturn(true);

        assertThrows(EmailAlreadyExistsException.class,
                () -> authService.register(registerRequest("bob", "foo@bar.com", "secret123")));
        verify(userRepository, never()).save(any());
    }

    @Test
    void registerRejectsDuplicateUsername() {
        when(userRepository.existsByEmail("foo@bar.com")).thenReturn(false);
        when(userRepository.existsByUsername("bob")).thenReturn(true);

        assertThrows(UsernameAlreadyExistsException.class,
                () -> authService.register(registerRequest("bob", "foo@bar.com", "secret123")));
        verify(userRepository, never()).save(any());
    }

    @Test
    void registerHashesPasswordWithBCrypt() {
        when(userRepository.existsByEmail("foo@bar.com")).thenReturn(false);
        when(userRepository.existsByUsername("bob")).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArgument(0));

        authService.register(registerRequest("bob", "foo@bar.com", "secret123"));

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(saved.capture());
        String hash = saved.getValue().getPasswordHash();
        assertNotEquals("secret123", hash);
        assertTrue(passwordEncoder.matches("secret123", hash));
    }

    @Test
    void registerReturnsJwtToken() {
        when(userRepository.existsByEmail("foo@bar.com")).thenReturn(false);
        when(userRepository.existsByUsername("bob")).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArgument(0));
        when(jwtService.generateToken("foo@bar.com")).thenReturn("jwt-token");

        String token = authService.register(registerRequest("bob", "foo@bar.com", "secret123"));

        assertEquals("jwt-token", token);
    }

    @Test
    void loginRejectsUnknownEmail() {
        when(userRepository.findByEmail("foo@bar.com")).thenReturn(Optional.empty());

        assertThrows(InvalidCredentialsException.class,
                () -> authService.login(loginRequest("foo@bar.com", "secret123")));
    }

    @Test
    void loginRejectsWrongPassword() {
        User user = new User("bob", "foo@bar.com", passwordEncoder.encode("correct-password"));
        when(userRepository.findByEmail("foo@bar.com")).thenReturn(Optional.of(user));

        assertThrows(InvalidCredentialsException.class,
                () -> authService.login(loginRequest("foo@bar.com", "wrong-password")));
    }

    @Test
    void loginReturnsJwtTokenOnSuccess() {
        User user = new User("bob", "foo@bar.com", passwordEncoder.encode("secret123"));
        when(userRepository.findByEmail("foo@bar.com")).thenReturn(Optional.of(user));
        when(jwtService.generateToken("foo@bar.com")).thenReturn("jwt-token");

        String token = authService.login(loginRequest("  Foo@Bar.COM ", "secret123"));

        assertEquals("jwt-token", token);
    }
}
