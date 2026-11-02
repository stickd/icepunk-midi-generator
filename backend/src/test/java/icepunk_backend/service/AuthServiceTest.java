package icepunk_backend.service;

import icepunk_backend.dto.LoginRequest;
import icepunk_backend.dto.RegisterRequest;
import icepunk_backend.exception.EmailDeliveryException;
import icepunk_backend.exception.InvalidCredentialsException;
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
import static org.mockito.Mockito.doThrow;

/*
 * | EP                          | Input                       | Expected                          |
 * |-----------------------------|-----------------------------|-----------------------------------|
 * | email normalization         | "  Foo@Bar.COM "            | saved email = "foo@bar.com"       |
 * | duplicate email             | existsByEmail = true        | neutral no-op / recovery          |
 * | duplicate username          | existsByUsername = true      | neutral no-op                     |
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
    private final EmailVerificationService emailVerificationService = mock(EmailVerificationService.class);

    private final AuthService authService =
            new AuthService(userRepository, passwordEncoder, jwtService, emailVerificationService);

    private RegisterRequest registerRequest(String username, String email, String password) {
        RegisterRequest request = mock(RegisterRequest.class);
        when(request.getUsername()).thenReturn(username);
        when(request.getEmail()).thenReturn(email);
        when(request.getPassword()).thenReturn(password);
        when(request.isTermsAccepted()).thenReturn(true);
        return request;
    }

    private LoginRequest loginRequest(String identifier, String password) {
        LoginRequest request = mock(LoginRequest.class);
        when(request.getIdentifier()).thenReturn(identifier);
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
        assertEquals(false, saved.getValue().getVerified());
        verify(emailVerificationService).createAndSend(saved.getValue());
    }

    @Test
    void registerRecoversDuplicateUnverifiedEmail() {
        when(userRepository.existsByEmail("foo@bar.com")).thenReturn(true);
        User user = new User("bob", "foo@bar.com", passwordEncoder.encode("secret123"));
        user.setVerified(false);
        when(userRepository.findByEmail("foo@bar.com")).thenReturn(Optional.of(user));

        authService.register(registerRequest("bob", "foo@bar.com", "secret123"));
        verify(userRepository, never()).save(any());
        verify(emailVerificationService).createAndSend(user);
    }

    @Test
    void registerDoesNotRevealDuplicateVerifiedEmail() {
        when(userRepository.existsByEmail("foo@bar.com")).thenReturn(true);
        User user = new User("bob", "foo@bar.com", passwordEncoder.encode("secret123"));
        user.setVerified(true);
        when(userRepository.findByEmail("foo@bar.com")).thenReturn(Optional.of(user));

        authService.register(registerRequest("bob", "foo@bar.com", "secret123"));
        verify(userRepository, never()).save(any());
        verify(emailVerificationService, never()).createAndSend(any());
    }

    @Test
    void failedInitialDeliveryCanBeRecoveredByRetryingRegistration() {
        when(userRepository.existsByEmail("foo@bar.com")).thenReturn(false, true);
        when(userRepository.existsByUsername("bob")).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArgument(0));
        doThrow(new EmailDeliveryException()).doNothing()
                .when(emailVerificationService).createAndSend(any(User.class));

        assertThrows(EmailDeliveryException.class,
                () -> authService.register(registerRequest("bob", "foo@bar.com", "secret123")));

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(saved.capture());
        when(userRepository.findByEmail("foo@bar.com")).thenReturn(Optional.of(saved.getValue()));
        authService.register(registerRequest("bob", "foo@bar.com", "secret123"));

        verify(emailVerificationService, org.mockito.Mockito.times(2)).createAndSend(saved.getValue());
    }

    @Test
    void registerDoesNotRevealDuplicateUsername() {
        when(userRepository.existsByEmail("foo@bar.com")).thenReturn(false);
        when(userRepository.existsByUsername("bob")).thenReturn(true);

        authService.register(registerRequest("bob", "foo@bar.com", "secret123"));
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
        String token = authService.register(registerRequest("bob", "foo@bar.com", "secret123"));
        assertEquals(null, token);
    }

    @Test
    void loginRejectsUnknownEmail() {
        when(userRepository.findByEmail("foo@bar.com")).thenReturn(Optional.empty());
        when(userRepository.findByUsernameIgnoreCase("foo@bar.com")).thenReturn(Optional.empty());

        assertThrows(InvalidCredentialsException.class,
                () -> authService.login(loginRequest("foo@bar.com", "secret123")));
    }

    @Test
    void loginSucceedsWithUsernameInsteadOfEmail() {
        User user = new User("bob", "foo@bar.com", passwordEncoder.encode("secret123"));
        user.setVerified(true);
        when(userRepository.findByEmail("bob")).thenReturn(Optional.empty());
        when(userRepository.findByUsernameIgnoreCase("bob")).thenReturn(Optional.of(user));
        when(jwtService.generateToken("foo@bar.com")).thenReturn("jwt-token");

        String token = authService.login(loginRequest("bob", "secret123"));

        assertEquals("jwt-token", token);
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
        user.setVerified(true);
        when(userRepository.findByEmail("foo@bar.com")).thenReturn(Optional.of(user));
        when(jwtService.generateToken("foo@bar.com")).thenReturn("jwt-token");

        String token = authService.login(loginRequest("  Foo@Bar.COM ", "secret123"));

        assertEquals("jwt-token", token);
    }

    @Test
    void maskEmailForLogsKeepsOnlyFirstLocalCharacterAndDomain() {
        assertEquals("j***@gmail.com", AuthService.maskEmailForLogs("john.doe@gmail.com"));
        assertEquals("f***@bar.com", AuthService.maskEmailForLogs("  Foo@Bar.COM "));
    }

    @Test
    void maskEmailForLogsHandlesBoundaryValues() {
        assertEquals("***", AuthService.maskEmailForLogs(null));
        assertEquals("***", AuthService.maskEmailForLogs(" "));
        assertEquals("a***@example.com", AuthService.maskEmailForLogs("a@example.com"));
        assertEquals("i***", AuthService.maskEmailForLogs("invalid-email"));
    }
}
