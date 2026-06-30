package icepunk_backend.integration;

import icepunk_backend.model.GenerationStats;
import icepunk_backend.repository.GenerationStatsRepository;
import icepunk_backend.service.GenerationStatsService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Verifies that the {@code SELECT ... FOR UPDATE} row lock in
 * {@link GenerationStatsService#incrementTotalGenerations()} serialises
 * concurrent read-modify-write cycles so no increment is lost.
 */
class GenerationStatsConcurrencyIntegrationTest extends AbstractPostgresContainerTest {

    private static final int THREADS = 8;
    private static final int INCREMENTS_PER_THREAD = 25;

    @Autowired
    private GenerationStatsService generationStatsService;

    @Autowired
    private GenerationStatsRepository generationStatsRepository;

    @BeforeEach
    void seedGlobalRow() {
        generationStatsRepository.deleteAll();
        generationStatsRepository.save(new GenerationStats(GenerationStats.GLOBAL_STATS_ID, 0L));
    }

    @Test
    void concurrentIncrementsDoNotLoseUpdates() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(THREADS);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<?>> futures = new ArrayList<>();

        try {
            for (int t = 0; t < THREADS; t++) {
                futures.add(pool.submit(() -> {
                    start.await();
                    for (int i = 0; i < INCREMENTS_PER_THREAD; i++) {
                        generationStatsService.incrementTotalGenerations();
                    }
                    return null;
                }));
            }

            start.countDown(); // release all threads at once

            for (Future<?> future : futures) {
                future.get(60, TimeUnit.SECONDS);
            }
        } finally {
            pool.shutdownNow();
        }

        assertEquals((long) THREADS * INCREMENTS_PER_THREAD,
                generationStatsService.getTotalGenerations());
    }
}
