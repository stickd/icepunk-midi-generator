package icepunk_backend.integration;

import icepunk_backend.model.User;
import icepunk_backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Verifies the PostgreSQL-enforced unique constraints on {@code users} and the
 * pessimistic ({@code SELECT ... FOR UPDATE}) row lock used by
 * {@link UserRepository#findByEmailForUpdate(String)}.
 */
class UserConstraintsIntegrationTest extends AbstractPostgresContainerTest {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @BeforeEach
    void clearUsers() {
        userRepository.deleteAll();
    }

    @Test
    void duplicateEmailViolatesUniqueConstraint() {
        userRepository.saveAndFlush(new User("alice", "dupe@example.com", "hash-a"));

        User sameEmail = new User("bob", "dupe@example.com", "hash-b");

        assertThrows(DataIntegrityViolationException.class,
                () -> userRepository.saveAndFlush(sameEmail));
    }

    @Test
    void duplicateUsernameViolatesUniqueConstraint() {
        userRepository.saveAndFlush(new User("charlie", "charlie@example.com", "hash-c"));

        User sameUsername = new User("charlie", "charlie2@example.com", "hash-d");

        assertThrows(DataIntegrityViolationException.class,
                () -> userRepository.saveAndFlush(sameUsername));
    }

    /**
     * Two transactions race for the same row. The holder acquires the row lock
     * via {@code findByEmailForUpdate}, holds it while a second transaction
     * attempts the same locking read, and only releases on commit. The waiter
     * must therefore block until the holder commits — proven by the waiter
     * acquiring the lock strictly after the holder released it.
     */
    @Test
    void findByEmailForUpdateLocksRowUntilCommit() throws Exception {
        userRepository.saveAndFlush(new User("locky", "lock@example.com", "hash-l"));

        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        CountDownLatch holderHasLock = new CountDownLatch(1);
        CountDownLatch releaseHolder = new CountDownLatch(1);
        AtomicLong holderReleasedAt = new AtomicLong();
        AtomicLong waiterAcquiredAt = new AtomicLong();

        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<?> holder = pool.submit(() -> tx.executeWithoutResult(status -> {
                User locked = userRepository.findByEmailForUpdate("lock@example.com").orElseThrow();
                holderHasLock.countDown();
                await(releaseHolder);
                locked.setGenerationsToday(1);
                userRepository.saveAndFlush(locked);
                // Lock is released on commit, just after this transaction body returns.
                holderReleasedAt.set(System.nanoTime());
            }));

            Future<?> waiter = pool.submit(() -> {
                await(holderHasLock);
                tx.executeWithoutResult(status -> {
                    userRepository.findByEmailForUpdate("lock@example.com").orElseThrow();
                    waiterAcquiredAt.set(System.nanoTime());
                });
            });

            // Give the waiter time to reach its (blocked) FOR UPDATE before releasing the holder.
            Thread.sleep(750);
            releaseHolder.countDown();

            holder.get(15, TimeUnit.SECONDS);
            waiter.get(15, TimeUnit.SECONDS);
        } finally {
            pool.shutdownNow();
        }

        assertTrue(waiterAcquiredAt.get() >= holderReleasedAt.get(),
                "second transaction must acquire the row lock only after the first releases it");
        assertEquals(1, userRepository.findByEmail("lock@example.com").orElseThrow().getGenerationsToday());
    }

    private static void await(CountDownLatch latch) {
        try {
            if (!latch.await(15, TimeUnit.SECONDS)) {
                throw new IllegalStateException("timed out waiting for latch");
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }
}
