package icepunk_backend.service;

import icepunk_backend.model.EmailVerificationToken;
import icepunk_backend.model.User;
import icepunk_backend.repository.EmailVerificationTokenRepository;
import icepunk_backend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.OffsetDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class EmailVerificationServiceTest {
    private final EmailVerificationTokenRepository tokens = mock(EmailVerificationTokenRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final EmailService email = mock(EmailService.class);
    private final EmailVerificationService service = new EmailVerificationService(tokens, users, email, 60);

    @Test
    void createsRandomTokenButPersistsOnlyItsHash() {
        User user = new User("neo", "neo@example.com", "hash");
        service.createAndSend(user);
        ArgumentCaptor<EmailVerificationToken> stored = ArgumentCaptor.forClass(EmailVerificationToken.class);
        ArgumentCaptor<String> raw = ArgumentCaptor.forClass(String.class);
        verify(tokens).save(stored.capture());
        verify(email).sendVerificationEmail(eq("neo@example.com"), raw.capture());
        assertNotEquals(raw.getValue(), stored.getValue().getTokenHash());
        assertEquals(64, stored.getValue().getTokenHash().length());
        assertEquals(EmailVerificationService.hash(raw.getValue()), stored.getValue().getTokenHash());
    }

    @Test
    void validTokenVerifiesAndCannotBeReused() {
        User user = new User("neo", "neo@example.com", "hash");
        user.setVerified(false);
        String raw = "secure-token";
        EmailVerificationToken token = new EmailVerificationToken(user, EmailVerificationService.hash(raw), OffsetDateTime.now().minusMinutes(1), OffsetDateTime.now().plusMinutes(10));
        when(tokens.findByTokenHashForUpdate(EmailVerificationService.hash(raw))).thenReturn(Optional.of(token));
        assertEquals(EmailVerificationService.Result.VERIFIED, service.verify(raw));
        assertTrue(user.getVerified());
        assertNotNull(token.getUsedAt());
        assertEquals(EmailVerificationService.Result.ALREADY_USED, service.verify(raw));
    }

    @Test
    void invalidTokenIsRejected() {
        when(tokens.findByTokenHashForUpdate(anyString())).thenReturn(Optional.empty());
        assertEquals(EmailVerificationService.Result.INVALID, service.verify("not-found"));
    }
}
