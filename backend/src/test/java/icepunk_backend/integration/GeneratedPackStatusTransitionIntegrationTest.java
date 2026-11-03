package icepunk_backend.integration;

import icepunk_backend.model.GeneratedPack;
import icepunk_backend.model.GeneratedPackStatus;
import icepunk_backend.model.GeneratedPackType;
import icepunk_backend.model.GeneratedPackVisibility;
import icepunk_backend.model.GenerationSourceType;
import icepunk_backend.repository.GeneratedPackRepository;
import icepunk_backend.service.GeneratedPackTransactionService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertFalse;

class GeneratedPackStatusTransitionIntegrationTest extends AbstractPostgresContainerTest {

    @Autowired
    private GeneratedPackRepository packs;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private GeneratedPackTransactionService transactions;

    @Test
    @Transactional
    void recoveryQueriesAreBoundedStableAndExcludeWrongStatuses() {
        OffsetDateTime old = OffsetDateTime.now().minusHours(2);
        GeneratedPack first = savePack(GeneratedPackStatus.PENDING); first.setCreatedAt(old.minusMinutes(1)); packs.saveAndFlush(first);
        GeneratedPack second = savePack(GeneratedPackStatus.PENDING); second.setCreatedAt(old); packs.saveAndFlush(second);
        GeneratedPack fresh = savePack(GeneratedPackStatus.PENDING);
        GeneratedPack ready = savePack(GeneratedPackStatus.READY); ready.setCleanupRequired(true); packs.saveAndFlush(ready);
        GeneratedPack failed = savePack(GeneratedPackStatus.FAILED); failed.setCleanupRequired(true); packs.saveAndFlush(failed);
        entityManager.clear();

        List<GeneratedPack> stale = packs.findStaleByStatus(GeneratedPackStatus.PENDING, old, PageRequest.of(0, 1)).getContent();
        assertEquals(1, stale.size());
        assertEquals(first.getId(), stale.getFirst().getId());
        assertEquals(List.of(failed.getId()), packs.findCleanupRequired(PageRequest.of(0, 1)).getContent().stream().map(GeneratedPack::getId).toList());
        assertEquals(GeneratedPackStatus.PENDING, packs.findById(fresh.getId()).orElseThrow().getStatus());
    }

    @Test
    void deletionTransitionsAreConditionalAndCompletionOnlyDeletesCleanDeletePendingPack() {
        GeneratedPack ready = savePack(GeneratedPackStatus.READY);
        GeneratedPack pending = savePack(GeneratedPackStatus.PENDING);
        GeneratedPack failed = savePack(GeneratedPackStatus.FAILED);
        assertTrue(transactions.markDeletionPendingIfReady(ready.getId()));
        assertFalse(transactions.markDeletionPendingIfReady(ready.getId()));
        assertFalse(transactions.markDeletionPendingIfReady(pending.getId()));
        assertFalse(transactions.markDeletionPendingIfReady(failed.getId()));
        assertFalse(transactions.markDeletionPendingIfReady(UUID.randomUUID()));
        entityManager.clear();
        assertEquals("DELETE_PENDING", packs.findById(ready.getId()).orElseThrow().getFailureCode());
        assertTrue(transactions.completeDeletionIfPending(ready.getId()));
        assertTrue(packs.findById(ready.getId()).isEmpty());
        assertFalse(transactions.completeDeletionIfPending(pending.getId()));
    }

    @Test
    @Transactional
    void markReadyIfPendingUpdatesOnlyPendingRowsAndFinalizesOnlySuccessfulTransition() {
        GeneratedPack pending = savePack(GeneratedPackStatus.PENDING);
        GeneratedPack failed = savePack(GeneratedPackStatus.FAILED);
        GeneratedPack ready = savePack(GeneratedPackStatus.READY);

        assertEquals(1, packs.markReadyIfPending(pending.getId()));
        assertEquals(0, packs.markReadyIfPending(failed.getId()));
        assertEquals(0, packs.markReadyIfPending(ready.getId()));

        entityManager.flush();
        entityManager.clear();

        GeneratedPack finalized = packs.findById(pending.getId()).orElseThrow();
        assertEquals(GeneratedPackStatus.READY, finalized.getStatus());
        assertNotNull(finalized.getFinalizedAt());
        assertNull(finalized.getFailureCode());
        assertEquals(GeneratedPackStatus.FAILED, packs.findById(failed.getId()).orElseThrow().getStatus());
        assertEquals(GeneratedPackStatus.READY, packs.findById(ready.getId()).orElseThrow().getStatus());
    }

    @Test
    @Transactional
    void markFailedIfPendingUpdatesOnlyPendingRowsAndLeavesTerminalRowsUntouched() {
        GeneratedPack pending = savePack(GeneratedPackStatus.PENDING);
        GeneratedPack ready = savePack(GeneratedPackStatus.READY);
        GeneratedPack failed = savePack(GeneratedPackStatus.FAILED);
        OffsetDateTime updatedAt = OffsetDateTime.parse("2026-07-16T12:00:00Z");

        assertEquals(1, packs.markFailedIfPending(pending.getId(), "MIDI_VALIDATION_FAILED", updatedAt));
        assertEquals(0, packs.markFailedIfPending(ready.getId(), "SHOULD_NOT_WRITE", updatedAt));
        assertEquals(0, packs.markFailedIfPending(failed.getId(), "SHOULD_NOT_WRITE", updatedAt));
        assertEquals(0, packs.markFailedIfPending(UUID.randomUUID(), "MISSING", updatedAt));

        entityManager.flush();
        entityManager.clear();

        GeneratedPack transitioned = packs.findById(pending.getId()).orElseThrow();
        assertEquals(GeneratedPackStatus.FAILED, transitioned.getStatus());
        assertEquals("MIDI_VALIDATION_FAILED", transitioned.getFailureCode());
        assertEquals(updatedAt, transitioned.getUpdatedAt());
        assertEquals(GeneratedPackStatus.READY, packs.findById(ready.getId()).orElseThrow().getStatus());
        assertEquals(GeneratedPackStatus.FAILED, packs.findById(failed.getId()).orElseThrow().getStatus());
    }

    private GeneratedPack savePack(GeneratedPackStatus status) {
        GeneratedPack pack = new GeneratedPack();
        pack.setId(UUID.randomUUID());
        pack.setName("Transition test");
        pack.setSourceType(GenerationSourceType.FACTORY);
        pack.setGenerationType(GeneratedPackType.MELODY);
        pack.setAmount(1);
        pack.setVisibility(GeneratedPackVisibility.PRIVATE);
        pack.setZipObjectKey("transition/" + UUID.randomUUID() + ".zip");
        pack.setStatus(status);
        pack.setCreatedAt(OffsetDateTime.now());
        return packs.saveAndFlush(pack);
    }
}
