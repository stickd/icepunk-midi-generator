package icepunk_backend.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import icepunk_backend.service.AccountDeletionService;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.testcontainers.containers.PostgreSQLContainer;
import software.amazon.awssdk.services.s3.S3Client;
import java.util.function.Consumer;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AccountDeletionIntegrationTest {
    @Test
    @SuppressWarnings("unchecked")
    void concurrentProcessorsClaimAndFinaliseOnlyOnce() throws Exception {
        try (var fixture = new DeletionFixture()) {
            var db = fixture.db;
            // Count committed service transitions in PostgreSQL, not mock repository calls.
            db.execute("create table deletion_test_events (status text not null)");
            db.execute("""
                    create function record_deletion_transition() returns trigger language plpgsql as $$
                    begin
                      if new.status is distinct from old.status then
                        insert into deletion_test_events values (new.status);
                      end if;
                      return new;
                    end $$
                    """);
            db.execute("create trigger deletion_transition after update on account_deletion_jobs for each row execute function record_deletion_transition()");
            var storageEntered = new java.util.concurrent.CountDownLatch(1);
            var releaseStorage = new java.util.concurrent.CountDownLatch(1);
            doAnswer(call -> {
                storageEntered.countDown();
                assertTrue(releaseStorage.await(15, java.util.concurrent.TimeUnit.SECONDS), "Storage release timed out");
                return software.amazon.awssdk.services.s3.model.DeleteObjectResponse.builder().build();
            }).when(fixture.s3).deleteObject(any(Consumer.class));
            var workers = java.util.concurrent.Executors.newFixedThreadPool(2);
            try {
                var first = workers.submit(() -> fixture.service().processNext());
                assertTrue(storageEntered.await(10, java.util.concurrent.TimeUnit.SECONDS));
                // The first transaction still holds its row lock while a separate service/connection runs.
                var second = workers.submit(() -> fixture.service().processNext());
                second.get(5, java.util.concurrent.TimeUnit.SECONDS);
                assertFalse(first.isDone(), "Second processor must skip while the first holds the lock");
                releaseStorage.countDown();
                first.get(10, java.util.concurrent.TimeUnit.SECONDS);
            } finally {
                releaseStorage.countDown();
                workers.shutdownNow();
                assertTrue(workers.awaitTermination(10, java.util.concurrent.TimeUnit.SECONDS));
            }
            assertEquals(1, db.queryForObject("select count(*) from deletion_test_events where status='PROCESSING'", Integer.class));
            assertEquals(1, db.queryForObject("select count(*) from deletion_test_events where status='COMPLETE'", Integer.class));
            fixture.service().processNext();
            fixture.assertCompleteAndIsolated();
            fixture.assertOnlyAObjectDeleted(1);
        }
    }

    @Test
    @SuppressWarnings("unchecked")
    void retryMaximumRetainsRecoveryDataAndOperatorRecoveryCompletes() {
        try (var fixture = new DeletionFixture()) {
            var db = fixture.db;
            String snapshot = db.queryForObject("select object_keys::text from account_deletion_jobs", String.class);
            assertEquals("[\"a.mid\"]", snapshot);
            doThrow(new RuntimeException("provider failure details must not be persisted"))
                    .when(fixture.s3).deleteObject(any(Consumer.class));
            for (int attempt = 1; attempt <= DeletionFixture.MAX_ATTEMPTS; attempt++) {
                fixture.service().processNext();
                assertEquals(attempt < DeletionFixture.MAX_ATTEMPTS ? "RETRY" : "FAILED",
                        db.queryForObject("select status from account_deletion_jobs", String.class));
                assertEquals(attempt, db.queryForObject("select retry_count from account_deletion_jobs", Integer.class));
                assertEquals("DELETION_PENDING", db.queryForObject("select account_status from users where id=?", String.class, fixture.a));
                assertEquals(snapshot, db.queryForObject("select object_keys::text from account_deletion_jobs", String.class));
                assertEquals(fixture.a, db.queryForObject("select user_id from account_deletion_jobs", Long.class));
                assertEquals(fixture.a, db.queryForObject("select user_id_snapshot from account_deletion_jobs", Long.class));
                assertEquals("a.mid", db.queryForObject("select midi_object_key from user_uploaded_projects where owner_id=?", String.class, fixture.a));
                assertEquals("Object cleanup failed", db.queryForObject("select last_error from account_deletion_jobs", String.class));
                assertNull(db.queryForObject("select completed_at from account_deletion_jobs", java.sql.Timestamp.class));
                db.update("update account_deletion_jobs set updated_at=now()-interval '61 seconds'");
            }
            // Even when old enough, FAILED jobs are not automatically retried or discarded.
            fixture.service().processNext();
            fixture.assertOnlyAObjectDeleted(DeletionFixture.MAX_ATTEMPTS);
            assertEquals("FAILED", db.queryForObject("select status from account_deletion_jobs", String.class));
            var jobId = db.queryForObject("select id from account_deletion_jobs", java.util.UUID.class);
            // Exact guarded recovery operation documented in ACCOUNT_DELETION_OPERATIONS.md.
            assertEquals(1, db.update("""
                    UPDATE account_deletion_jobs
                    SET status = 'RETRY', retry_count = 0, last_error = NULL,
                        updated_at = now() - interval '61 seconds'
                    WHERE id = ? AND status = 'FAILED'
                    """, jobId));
            assertEquals("DELETION_PENDING", db.queryForObject("select account_status from users where id=?", String.class, fixture.a));
            reset(fixture.s3);
            fixture.service().processNext();
            fixture.assertCompleteAndIsolated();
            fixture.assertOnlyAObjectDeleted(1);
            assertEquals(0, db.queryForObject("select retry_count from account_deletion_jobs", Integer.class));
            assertNull(db.queryForObject("select last_error from account_deletion_jobs", String.class));
        }
    }

    private static class DeletionFixture implements AutoCloseable {
        static final int MAX_ATTEMPTS = 10;
        final PostgreSQLContainer<?> pg = new PostgreSQLContainer<>("postgres:16-alpine");
        final JdbcTemplate db;
        final DataSourceTransactionManager manager;
        final S3Client s3 = mock(S3Client.class);
        final Long a;
        final Long b;

        DeletionFixture() {
            pg.start();
            var source = new DriverManagerDataSource(pg.getJdbcUrl(), pg.getUsername(), pg.getPassword());
            Flyway.configure().dataSource(source).load().migrate();
            db = new JdbcTemplate(source);
            manager = new DataSourceTransactionManager(source);
            db.update("insert into users(username,email,password_hash) values ('A','a@test.invalid','hash'),('B','b@test.invalid','hash')");
            a = db.queryForObject("select id from users where username='A'", Long.class);
            b = db.queryForObject("select id from users where username='B'", Long.class);
            db.update("insert into user_uploaded_projects(owner_id,title,midi_object_key) values (?,'A','a.mid'),(?,'B','b.mid')", a, b);
            service().request("a@test.invalid");
        }

        AccountDeletionService service() {
            return new AccountDeletionService(db, manager, s3, new ObjectMapper(), "bucket", MAX_ATTEMPTS);
        }

        void assertCompleteAndIsolated() {
            assertEquals("COMPLETE", db.queryForObject("select status from account_deletion_jobs", String.class));
            assertNull(db.queryForObject("select user_id from account_deletion_jobs", Long.class));
            assertEquals(a, db.queryForObject("select user_id_snapshot from account_deletion_jobs", Long.class));
            assertNotNull(db.queryForObject("select completed_at from account_deletion_jobs", java.sql.Timestamp.class));
            assertEquals("[]", db.queryForObject("select object_keys::text from account_deletion_jobs", String.class));
            assertEquals(b, db.queryForObject("select id from users", Long.class));
            assertEquals("ACTIVE", db.queryForObject("select account_status from users", String.class));
            assertEquals(b, db.queryForObject("select owner_id from user_uploaded_projects", Long.class));
            assertEquals("b.mid", db.queryForObject("select midi_object_key from user_uploaded_projects", String.class));
        }

        @SuppressWarnings("unchecked")
        void assertOnlyAObjectDeleted(int count) {
            var captured = org.mockito.ArgumentCaptor.forClass(Consumer.class);
            verify(s3, times(count)).deleteObject(captured.capture());
            for (Consumer call : captured.getAllValues()) {
                var builder = software.amazon.awssdk.services.s3.model.DeleteObjectRequest.builder();
                call.accept(builder);
                assertEquals("a.mid", builder.build().key());
                assertEquals("bucket", builder.build().bucket());
            }
        }

        public void close() { pg.close(); }
    }

    @Test
    @SuppressWarnings("unchecked")
    void durableFailureRetryAndIsolation() {
        try (var pg = new PostgreSQLContainer<>("postgres:16-alpine")) {
            pg.start();
            var source = new DriverManagerDataSource(pg.getJdbcUrl(),pg.getUsername(),pg.getPassword());
            Flyway.configure().dataSource(source).target("10").load().migrate();
            Flyway.configure().dataSource(source).load().migrate();
            var db = new JdbcTemplate(source);
            db.update("insert into users(username,email,password_hash) values ('A','a@test.invalid','hash'),('B','b@test.invalid','hash')");
            Long a = db.queryForObject("select id from users where username='A'",Long.class);
            Long b = db.queryForObject("select id from users where username='B'",Long.class);
            db.update("insert into user_uploaded_projects(owner_id,title,midi_object_key) values (?,'A','a.mid'),(?,'B','b.mid')",a,b);
            var s3 = mock(S3Client.class);
            var pack = java.util.UUID.randomUUID();
            db.update("insert into generated_packs(id,owner_id,name,source_type,generation_type,amount,zip_object_key) values (?,?,'A','FACTORY','MELODY',1,'a.zip')",pack,a);
            db.update("insert into generated_pack_items(id,pack_id,item_index,file_name,midi_object_key) values (?,?,0,'A.mid','generated-a.mid')",java.util.UUID.randomUUID(),pack);
            db.update("update user_uploaded_projects set sample_object_key='a.wav' where owner_id=?",a);
            db.update("update users set profile_picture_url='avatars/a.png' where id=?",a);
            db.update("insert into dataset_presets(id,owner_id,name,analysis_object_key,source_midi_count) values (?,?,'A','a.json',1)",java.util.UUID.randomUUID(),a);
            var manager = new DataSourceTransactionManager(source);
            var service = new AccountDeletionService(db,manager,s3,new ObjectMapper(),"bucket",10);
            service.request("a@test.invalid");
            service.request("a@test.invalid");
            assertEquals(1,db.queryForObject("select count(*) from account_deletion_jobs",Integer.class));
            assertEquals("DELETION_PENDING",db.queryForObject("select account_status from users where id=?",String.class,a));
            doThrow(new RuntimeException("storage down")).when(s3).deleteObject(any(Consumer.class));
            service.processNext();
            assertEquals("RETRY",db.queryForObject("select status from account_deletion_jobs",String.class));
            assertEquals(1,db.queryForObject("select retry_count from account_deletion_jobs",Integer.class));
            assertEquals(2,db.queryForObject("select count(*) from users",Integer.class));
            assertEquals(2,db.queryForObject("select count(*) from user_uploaded_projects",Integer.class));
            reset(s3);
            db.update("update account_deletion_jobs set updated_at=now()-interval '2 minutes'");
            new AccountDeletionService(db,manager,s3,new ObjectMapper(),"bucket",10).processNext();
            assertEquals("COMPLETE",db.queryForObject("select status from account_deletion_jobs",String.class));
            assertEquals(b,db.queryForObject("select id from users",Long.class));
            assertEquals("b.mid",db.queryForObject("select midi_object_key from user_uploaded_projects",String.class));
            service.processNext();
            var captured = org.mockito.ArgumentCaptor.forClass(Consumer.class);
            verify(s3,times(6)).deleteObject(captured.capture());
            var deleted = new java.util.HashSet<String>();
            for (Consumer call : captured.getAllValues()) {
                var builder = software.amazon.awssdk.services.s3.model.DeleteObjectRequest.builder();
                call.accept(builder); deleted.add(builder.build().key());
            }
            assertEquals(java.util.Set.of("a.mid","a.zip","generated-a.mid","a.wav","avatars/a.png","a.json"),deleted);
            assertEquals(0,db.queryForObject("select count(*) from generated_packs",Integer.class));
            assertEquals(0,db.queryForObject("select count(*) from generated_pack_items",Integer.class));
            assertEquals(0,db.queryForObject("select count(*) from dataset_presets",Integer.class));
        }
    }
}
