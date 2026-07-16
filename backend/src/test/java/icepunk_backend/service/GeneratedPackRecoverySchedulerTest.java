package icepunk_backend.service;

import icepunk_backend.model.GeneratedPack;
import icepunk_backend.model.GeneratedPackStatus;
import icepunk_backend.repository.GeneratedPackRepository;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class GeneratedPackRecoverySchedulerTest {
    private final GeneratedPackRepository packs = mock(GeneratedPackRepository.class);
    private final GeneratedPackTransactionService transactions = mock(GeneratedPackTransactionService.class);
    private final GeneratedPackCleanupService cleanup = mock(GeneratedPackCleanupService.class);
    private final GeneratedPackRecoveryScheduler scheduler = new GeneratedPackRecoveryScheduler(
            packs, transactions, cleanup, true, 30, 2);

    @Test
    void freshPendingPackIsNotSelected() {
        when(packs.findStaleByStatus(eq(GeneratedPackStatus.PENDING), any(), any())).thenReturn(new PageImpl<>(List.of()));
        when(packs.findCleanupRequired(any())).thenReturn(new PageImpl<>(List.of()));
        scheduler.recover();
        verifyNoInteractions(transactions, cleanup);
    }

    @Test
    void stalePendingTransitionsThenCleansOnlyAfterSuccessfulConditionalUpdate() {
        GeneratedPack stale = pack(GeneratedPackStatus.PENDING, false);
        when(packs.findStaleByStatus(eq(GeneratedPackStatus.PENDING), any(), any())).thenReturn(new PageImpl<>(List.of(stale)));
        when(packs.findCleanupRequired(any())).thenReturn(new PageImpl<>(List.of()));
        when(transactions.markFailedIfPending(stale.getId(), "STALE_PENDING")).thenReturn(true);

        scheduler.recover();

        verify(transactions).markFailedIfPending(stale.getId(), "STALE_PENDING");
        verify(cleanup).cleanup(stale.getId());
    }

    @Test
    void readyRaceDoesNotTriggerCleanupAndOneFailureDoesNotBlockNextPack() {
        GeneratedPack racedReady = pack(GeneratedPackStatus.PENDING, false);
        GeneratedPack next = pack(GeneratedPackStatus.PENDING, false);
        when(packs.findStaleByStatus(eq(GeneratedPackStatus.PENDING), any(), any())).thenReturn(new PageImpl<>(List.of(racedReady, next)));
        when(packs.findCleanupRequired(any())).thenReturn(new PageImpl<>(List.of()));
        when(transactions.markFailedIfPending(racedReady.getId(), "STALE_PENDING")).thenReturn(false);
        when(transactions.markFailedIfPending(next.getId(), "STALE_PENDING")).thenReturn(true);
        doThrow(new RuntimeException("cleanup failure")).when(cleanup).cleanup(next.getId());

        scheduler.recover();

        verify(cleanup, never()).cleanup(racedReady.getId());
        verify(cleanup).cleanup(next.getId());
    }

    @Test
    void cleanupRetryUsesBoundedQueryAndAttemptsEverySelectedPack() {
        GeneratedPack first = pack(GeneratedPackStatus.FAILED, true);
        GeneratedPack second = pack(GeneratedPackStatus.FAILED, true);
        when(packs.findStaleByStatus(eq(GeneratedPackStatus.PENDING), any(), any())).thenReturn(new PageImpl<>(List.of()));
        when(packs.findCleanupRequired(any())).thenReturn(new PageImpl<>(List.of(first, second)));

        scheduler.recover();

        verify(cleanup).cleanup(first.getId());
        verify(cleanup).cleanup(second.getId());
        verify(packs).findCleanupRequired(argThat(pageable -> pageable.getPageSize() == 2));
    }

    private GeneratedPack pack(GeneratedPackStatus status, boolean cleanupRequired) {
        GeneratedPack pack = new GeneratedPack();
        pack.setId(UUID.randomUUID());
        pack.setStatus(status);
        pack.setCleanupRequired(cleanupRequired);
        pack.setCreatedAt(OffsetDateTime.now().minusHours(1));
        return pack;
    }
}
