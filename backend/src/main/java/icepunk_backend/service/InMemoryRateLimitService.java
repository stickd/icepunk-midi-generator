package icepunk_backend.service;

import icepunk_backend.exception.RateLimitException;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
public class InMemoryRateLimitService {

    private static final int REGISTER_LIMIT = 3;
    private static final Duration REGISTER_WINDOW = Duration.ofHours(1);
    private static final int LOGIN_LIMIT = 5;
    private static final Duration LOGIN_WINDOW = Duration.ofMinutes(15);

    private final ConcurrentMap<String, WindowCounter> counters = new ConcurrentHashMap<>();

    public void checkRegisterLimit(String ipAddress) {
        checkLimit("register:" + ipAddress, REGISTER_LIMIT, REGISTER_WINDOW, "Too many registration attempts. Try again later.");
    }

    public void checkLoginLimit(String ipAddress) {
        checkLimit("login:" + ipAddress, LOGIN_LIMIT, LOGIN_WINDOW, "Too many login attempts. Try again later.");
    }

    private void checkLimit(String key, int limit, Duration window, String message) {
        Instant now = Instant.now();
        WindowCounter counter = counters.computeIfAbsent(key, ignored -> new WindowCounter(now.plus(window)));

        synchronized (counter) {
            if (!now.isBefore(counter.resetAt)) {
                counter.attempts = 0;
                counter.resetAt = now.plus(window);
            }

            if (counter.attempts >= limit) {
                throw new RateLimitException(message, Math.max(1, Duration.between(now, counter.resetAt).toSeconds()));
            }

            counter.attempts++;
        }
    }

    private static class WindowCounter {

        private int attempts;
        private Instant resetAt;

        private WindowCounter(Instant resetAt) {
            this.resetAt = resetAt;
        }
    }
}
