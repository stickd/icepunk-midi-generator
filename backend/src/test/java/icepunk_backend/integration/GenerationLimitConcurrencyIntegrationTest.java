package icepunk_backend.integration;

import icepunk_backend.controller.GenerateController;
import icepunk_backend.exception.GenerationLimitException;
import icepunk_backend.model.GenerationStats;
import icepunk_backend.model.GuestUsage;
import icepunk_backend.model.User;
import icepunk_backend.repository.GenerationStatsRepository;
import icepunk_backend.repository.GuestUsageRepository;
import icepunk_backend.repository.UserRepository;
import icepunk_backend.service.GeneratedPackStorageService;
import icepunk_backend.service.GenerationStatsService;
import icepunk_backend.service.MidiGenerationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
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
 * ({@link MidiGenerationService}) and generated object storage
 * stubbed out. This exercises the {@code SELECT ... FOR UPDATE} row lock in
 * {@code GenerationLimitService.incrementGuestUsage}, which is the true
 * enforcement point for the guest daily cap — the read-only
 * {@code checkGuestLimit} call has a check-then-act window that concurrent
 * requests can slip through, so the increment guard must hold the line.
 *
 * <p>The configured guest cap is {@code GUEST_DAILY_LIMIT = 5} (see
 * {@code GenerationLimitService}). The guest test fires more concurrent
 * requests than the cap and asserts that exactly the cap succeeds, the rest
 * are rejected with {@link GenerationLimitException}, and the global counter
 * advances only for the successful (uploaded) generations.
 *
 * <p>Registered users have no daily cap by design (generation is free) —
 * {@code checkUserLimit}/{@code incrementUserUsage} are intentional no-ops.
 * The user test instead asserts that concurrent requests are never rejected
 * and every one of them advances the global counter, pinning that "no
 * accidental rate limiting" contract under concurrency.
 */
class GenerationLimitConcurrencyIntegrationTest extends AbstractPostgresContainerTest {

    /** Mirrors {@code GenerationLimitService.GUEST_DAILY_LIMIT}. */
    private static final int GUEST_DAILY_LIMIT = 5;

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
    private GeneratedPackStorageService generatedPackStorageService;

    @TempDir
    Path tempDir;

    @BeforeEach
    void resetState() throws Exception {
        guestUsageRepository.deleteAll();
        userRepository.deleteAll();
        generationStatsRepository.deleteAll();
        generationStatsRepository.save(new GenerationStats(GenerationStats.GLOBAL_STATS_ID, 0L));

        // Every generation "succeeds" up to the upload: a fresh ZIP is produced
        // (the controller deletes it afterwards) and the upload returns a URL.
        when(midiGenerationService.generateFiles(any(), any()))
                .thenAnswer(invocation -> createGeneratedFiles());
        when(generatedPackStorageService.uploadMidi(any()))
                .thenAnswer(invocation -> {
                    String key = "generated_midi_items/" + UUID.randomUUID() + ".mid";
                    return new GeneratedPackStorageService.StoredObject(key);
                });
        when(generatedPackStorageService.uploadZip(any()))
                .thenAnswer(invocation -> {
                    String key = "generated_midi/" + UUID.randomUUID() + ".zip";
                    return new GeneratedPackStorageService.StoredObject(key);
                });
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
    void concurrentUserGenerationsAreNeverRateLimited() throws Exception {
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

        assertEquals(CONCURRENT_REQUESTS, succeeded,
                "registered users have no daily generation cap; none should be rejected");
        assertEquals(CONCURRENT_REQUESTS, generationStatsService.getTotalGenerations(),
                "global counter must advance for every successful (uploaded) generation");
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

    private MidiGenerationService.GeneratedFiles createGeneratedFiles() throws Exception {
        Path outputDir = Files.createDirectories(tempDir.resolve("generated-" + UUID.randomUUID()));
        Path midiPath = Files.writeString(outputDir.resolve("track.mid"), "midi");
        Path zipPath = Files.writeString(tempDir.resolve("pack-" + UUID.randomUUID() + ".zip"), "zip");
        return new MidiGenerationService.GeneratedFiles(outputDir, zipPath, List.of(midiPath));
    }
}
