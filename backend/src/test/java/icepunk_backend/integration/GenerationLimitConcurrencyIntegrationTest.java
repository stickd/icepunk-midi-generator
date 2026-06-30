package icepunk_backend.integration;

import icepunk_backend.controller.GenerateController;
import icepunk_backend.exception.GenerationLimitException;
import icepunk_backend.model.GenerationStats;
import icepunk_backend.model.GuestUsage;
import icepunk_backend.model.User;
import icepunk_backend.repository.GenerationStatsRepository;
import icepunk_backend.repository.GuestUsageRepository;
import icepunk_backend.repository.UserRepository;
import icepunk_backend.service.GenerationStatsService;
import icepunk_backend.service.MidiGenerationService;
import icepunk_backend.service.ZipStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.nio.file.Files;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Drives the real {@link GenerateController} from many threads at once against a
 * real PostgreSQL database, with only the Python subprocess
 * ({@link MidiGenerationService}) and S3 upload ({@link ZipStorageService})
 * stubbed out. This exercises the {@code SELECT ... FOR UPDATE} row locks in
 * {@code GenerationLimitService.incrementGuestUsage/incrementUserUsage}, which
 * are the true enforcement point for the daily caps — the read-only
 * {@code check*Limit} call has a check-then-act window that concurrent requests
 * can slip through, so the increment guard must hold the line.
 *
 * <p>The configured caps are {@code GUEST_DAILY_LIMIT = 3} and
 * {@code USER_DAILY_LIMIT = 7} (see {@code GenerationLimitService}). Each test
 * fires more concurrent requests than the cap and asserts that exactly the cap
 * succeeds, the rest are rejected with {@link GenerationLimitException}, and the
 * global counter advances only for the successful (uploaded) generations.
 */
class GenerationLimitConcurrencyIntegrationTest extends AbstractPostgresContainerTest {

    /** Mirrors {@code GenerationLimitService.GUEST_DAILY_LIMIT}. */
    private static final int GUEST_DAILY_LIMIT = 3;
    /** Mirrors {@code GenerationLimitService.USER_DAILY_LIMIT}. */
    private static final int USER_DAILY_LIMIT = 7;

    private static final String GUEST_IP = "203.0.113.7";
    private static final String USER_EMAIL = "racer@example.com";
    private static final int CONCURRENT_REQUESTS = 15;

    @Autowired
    private GenerateController generateController;

    @Autowired
    private GuestUsageRepository guestUsageRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private GenerationStatsRepository generationStatsRepository;

    @Autowired
    private GenerationStatsService generationStatsService;

    @MockitoBean
    private MidiGenerationService midiGenerationService;

    @MockitoBean
    private ZipStorageService zipStorageService;

    @BeforeEach
    void resetState() throws Exception {
        guestUsageRepository.deleteAll();
        userRepository.deleteAll();
        generationStatsRepository.deleteAll();
        generationStatsRepository.save(new GenerationStats(GenerationStats.GLOBAL_STATS_ID, 0L));

        // Every generation "succeeds" up to the upload: a fresh ZIP is produced
        // (the controller deletes it afterwards) and the upload returns a URL.
        when(midiGenerationService.generateZip())
                .thenAnswer(invocation -> Files.createTempFile("pack", ".zip"));
        when(zipStorageService.uploadZip(any()))
                .thenReturn("https://cdn.example/pack.zip");
    }

    @Test
    void concurrentGuestGenerationsDoNotExceedDailyLimit() throws Exception {
        GuestUsage seed = new GuestUsage(GUEST_IP);
        seed.setGenerationDate(LocalDate.now());
        seed.setGenerationsToday(0);
        guestUsageRepository.save(seed);

        int succeeded = runConcurrently(() -> {
            MockHttpServletRequest request = new MockHttpServletRequest();
            request.setRemoteAddr(GUEST_IP);
            generateController.generate(request);
            return null;
        });

        assertEquals(GUEST_DAILY_LIMIT, succeeded,
                "only the daily cap of guest generations may succeed under concurrency");
        assertEquals(GUEST_DAILY_LIMIT,
                guestUsageRepository.findByIpAddress(GUEST_IP).orElseThrow().getGenerationsToday(),
                "persisted guest usage must not exceed the cap");
        assertEquals(GUEST_DAILY_LIMIT, generationStatsService.getTotalGenerations(),
                "global counter must advance only for the successful (uploaded) generations");
    }

    @Test
    void concurrentUserGenerationsDoNotExceedDailyLimit() throws Exception {
        User seed = new User("racer", USER_EMAIL, "hash");
        seed.setGenerationDate(LocalDate.now());
        seed.setGenerationsToday(0);
        userRepository.save(seed);

        int succeeded = runConcurrently(() -> {
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken(USER_EMAIL, null, List.of()));
            try {
                generateController.generate(new MockHttpServletRequest());
            } finally {
                SecurityContextHolder.clearContext();
            }
            return null;
        });

        assertEquals(USER_DAILY_LIMIT, succeeded,
                "only the daily cap of user generations may succeed under concurrency");
        assertEquals(USER_DAILY_LIMIT,
                userRepository.findByEmail(USER_EMAIL).orElseThrow().getGenerationsToday(),
                "persisted user usage must not exceed the cap");
        assertEquals(USER_DAILY_LIMIT, generationStatsService.getTotalGenerations(),
                "global counter must advance only for the successful (uploaded) generations");
    }

    /**
     * Runs {@code task} on {@link #CONCURRENT_REQUESTS} threads released
     * simultaneously, counting how many completed normally. A
     * {@link GenerationLimitException} (the over-limit rejection) counts as a
     * non-success; any other failure aborts the test.
     */
    private int runConcurrently(Callable<Void> task) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(CONCURRENT_REQUESTS);
        CountDownLatch start = new CountDownLatch(1);
        AtomicInteger succeeded = new AtomicInteger();
        List<Future<?>> futures = new ArrayList<>();

        try {
            for (int i = 0; i < CONCURRENT_REQUESTS; i++) {
                futures.add(pool.submit(() -> {
                    start.await();
                    try {
                        task.call();
                        succeeded.incrementAndGet();
                    } catch (GenerationLimitException expected) {
                        // Over-limit request rejected — the cap held.
                    }
                    return null;
                }));
            }

            start.countDown();

            for (Future<?> future : futures) {
                future.get(60, TimeUnit.SECONDS);
            }
        } finally {
            pool.shutdownNow();
        }

        return succeeded.get();
    }
}
