package icepunk_backend.service;

import icepunk_backend.exception.RateLimitException;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AuthRateLimitServiceTest {

    @Test
    void reportsRejectEleventhAttempt() {
        when(redis.execute(any(RedisScript.class), anyList(), anyString())).thenReturn(10L, 11L);
        when(redis.getExpire(anyString())).thenReturn(100L);
        service.checkReportLimit(42L);
        assertThrows(RateLimitException.class, () -> service.checkReportLimit(42L));
    }

    private final StringRedisTemplate redis = mock(StringRedisTemplate.class);
    private final AuthRateLimitService service = new AuthRateLimitService(redis, 5, 5, 900, 3, 3, 3600, 3, 15);

    @Test
    void rejectsFourthRegisterAttemptWithinWindow() {
        when(redis.execute(any(RedisScript.class), anyList(), anyString()))
                .thenReturn(1L, 1L, 2L, 2L, 3L, 3L, 4L);
        when(redis.getExpire(anyString())).thenReturn(42L);
        service.checkRegisterLimit("127.0.0.1", "user@example.com");
        service.checkRegisterLimit("127.0.0.1", "user@example.com");
        service.checkRegisterLimit("127.0.0.1", "user@example.com");

        assertThrows(
                RateLimitException.class,
                () -> service.checkRegisterLimit("127.0.0.1", "user@example.com")
        );
    }

    @Test
    void rejectsSixthLoginAttemptWithinWindow() {
        when(redis.execute(any(RedisScript.class), anyList(), anyString()))
                .thenReturn(1L, 1L, 2L, 2L, 3L, 3L, 4L, 4L, 5L, 5L, 6L);
        when(redis.getExpire(anyString())).thenReturn(42L);
        service.checkLoginLimit("127.0.0.2", "user@example.com");
        service.checkLoginLimit("127.0.0.2", "user@example.com");
        service.checkLoginLimit("127.0.0.2", "user@example.com");
        service.checkLoginLimit("127.0.0.2", "user@example.com");
        service.checkLoginLimit("127.0.0.2", "user@example.com");

        assertThrows(
                RateLimitException.class,
                () -> service.checkLoginLimit("127.0.0.2", "user@example.com")
        );
    }

    @Test
    void failsClosedWhenRedisIsUnavailable() {
        when(redis.execute(any(RedisScript.class), anyList(), anyString()))
                .thenThrow(new DataAccessResourceFailureException("redis unavailable"));

        assertThrows(RateLimitException.class,
                () -> service.checkLoginLimit("127.0.0.2", "user@example.com"));
    }
}
