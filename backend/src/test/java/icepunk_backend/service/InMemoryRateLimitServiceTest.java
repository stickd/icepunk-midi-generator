package icepunk_backend.service;

import static org.junit.jupiter.api.Assertions.assertThrows;

import icepunk_backend.exception.RateLimitException;
import org.junit.jupiter.api.Test;

class InMemoryRateLimitServiceTest {

    private final InMemoryRateLimitService service = new InMemoryRateLimitService();

    @Test
    void rejectsFourthRegisterAttemptWithinWindow() {
        service.checkRegisterLimit("127.0.0.1");
        service.checkRegisterLimit("127.0.0.1");
        service.checkRegisterLimit("127.0.0.1");

        assertThrows(RateLimitException.class, () -> service.checkRegisterLimit("127.0.0.1"));
    }

    @Test
    void rejectsSixthLoginAttemptWithinWindow() {
        service.checkLoginLimit("127.0.0.2");
        service.checkLoginLimit("127.0.0.2");
        service.checkLoginLimit("127.0.0.2");
        service.checkLoginLimit("127.0.0.2");
        service.checkLoginLimit("127.0.0.2");

        assertThrows(RateLimitException.class, () -> service.checkLoginLimit("127.0.0.2"));
    }
}
