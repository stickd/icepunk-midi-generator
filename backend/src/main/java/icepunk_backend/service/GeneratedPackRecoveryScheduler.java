package icepunk_backend.service;

import icepunk_backend.model.GeneratedPackStatus;
import icepunk_backend.repository.GeneratedPackRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.concurrent.atomic.AtomicBoolean;

/** Single-instance beta scheduler; use a distributed lock before running multiple backend instances. */
@Service
public class GeneratedPackRecoveryScheduler {
    private static final Logger log = LoggerFactory.getLogger(GeneratedPackRecoveryScheduler.class);
    private final GeneratedPackRepository packs;
    private final GeneratedPackTransactionService transactions;
    private final GeneratedPackCleanupService cleanup;
    private final boolean enabled;
    private final long staleAfterMinutes;
    private final int batchSize;
    private final AtomicBoolean running = new AtomicBoolean(false);

    public GeneratedPackRecoveryScheduler(GeneratedPackRepository packs, GeneratedPackTransactionService transactions,
                                          GeneratedPackCleanupService cleanup,
                                          @Value("${generated.pack.recovery.enabled:true}") boolean enabled,
                                          @Value("${generated.pack.recovery.stale-after-minutes:30}") long staleAfterMinutes,
                                          @Value("${generated.pack.recovery.batch-size:50}") int batchSize) {
        this.packs = packs; this.transactions = transactions; this.cleanup = cleanup;
        this.enabled = enabled; this.staleAfterMinutes = staleAfterMinutes; this.batchSize = Math.max(1, batchSize);
    }

    @Scheduled(fixedDelayString = "${generated.pack.recovery.fixed-delay-ms:300000}")
    public void recover() {
        if (!enabled || !running.compareAndSet(false, true)) return;
        try {
            recoverStalePending();
            retryCleanupRequired();
        } finally { running.set(false); }
    }

    void recoverStalePending() {
        OffsetDateTime cutoff = OffsetDateTime.now().minusMinutes(Math.max(1, staleAfterMinutes));
        packs.findStaleByStatus(GeneratedPackStatus.PENDING, cutoff, PageRequest.of(0, batchSize)).forEach(pack -> {
            try {
                if (transactions.markFailedIfPending(pack.getId(), "STALE_PENDING")) cleanup.cleanup(pack.getId());
            } catch (RuntimeException ex) { log.warn("Stale generated pack recovery failed for pack={}: {}", pack.getId(), ex.getMessage()); }
        });
    }

    void retryCleanupRequired() {
        packs.findCleanupRequired(PageRequest.of(0, batchSize)).forEach(pack -> {
            try {
                GeneratedPackCleanupService.Result result = cleanup.cleanup(pack.getId());
                if (result.complete()) transactions.completeDeletionIfPending(pack.getId());
            }
            catch (RuntimeException ex) { log.warn("Generated pack cleanup retry failed for pack={}: {}", pack.getId(), ex.getMessage()); }
        });
    }
}
