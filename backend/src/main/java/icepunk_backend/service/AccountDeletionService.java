package icepunk_backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import software.amazon.awssdk.services.s3.S3Client;
import java.util.*;

@Service
public class AccountDeletionService {
    private final JdbcTemplate db;
    private final TransactionTemplate tx;
    private final S3Client storage;
    private final ObjectMapper json;
    private final String bucket;
    private final int maxAttempts;

    public AccountDeletionService(JdbcTemplate db, PlatformTransactionManager manager, S3Client storage,
            ObjectMapper json, @Value("${s3.bucket}") String bucket,
            @Value("${account.deletion.max-attempts:10}") int maxAttempts) {
        this.db = db; this.tx = new TransactionTemplate(manager); this.storage = storage;
        this.json = json; this.bucket = bucket; this.maxAttempts = Math.max(1, maxAttempts);
    }

    public void request(String email) {
        tx.executeWithoutResult(status -> {
            var rows = db.queryForList("select id, account_status from users where email = ? for update", email);
            if (rows.isEmpty()) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED);
            var user = rows.getFirst();
            if ("DELETION_PENDING".equals(user.get("account_status"))) return;
            long id = ((Number) user.get("id")).longValue();
            String snapshot = encode(keys(id));
            db.update("update users set account_status='DELETION_PENDING' where id=?", id);
            db.update("update generated_packs set visibility='PRIVATE' where owner_id=?", id);
            db.update("update user_uploaded_projects set visibility='PRIVATE' where owner_id=?", id);
            db.update("insert into account_deletion_jobs(id,user_id,user_id_snapshot,object_keys) values (?,?,?,cast(? as jsonb))",
                    UUID.randomUUID(), id, id, snapshot);
        });
    }

    private Set<String> keys(long id) {
        Set<String> keys = new LinkedHashSet<>();
        for (String query : List.of(
                "select zip_object_key from generated_packs where owner_id=?",
                "select i.midi_object_key from generated_pack_items i join generated_packs p on p.id=i.pack_id where p.owner_id=?",
                "select midi_object_key from user_uploaded_projects where owner_id=?",
                "select sample_object_key from user_uploaded_projects where owner_id=?",
                "select analysis_object_key from dataset_presets where owner_id=?",
                "select profile_picture_url from users where id=? and profile_picture_url like 'avatars/%'")) {
            db.query(query, rs -> { String key = rs.getString(1); if (key != null && !key.isBlank()) keys.add(key); }, id);
        }
        return keys;
    }

    private String encode(Collection<String> keys) {
        try { return json.writeValueAsString(keys); }
        catch (Exception e) { throw new IllegalStateException("Deletion snapshot unavailable"); }
    }

    public void processNext() {
        // Row lock spans external cleanup. A crash rolls the transaction back to
        // PENDING/RETRY; repeated S3 delete operations are idempotent.
        tx.executeWithoutResult(status -> {
            var jobs = db.queryForList("select * from account_deletion_jobs where status='PENDING' or (status='RETRY' and updated_at < now() - interval '60 seconds') order by created_at limit 1 for update skip locked");
            if (jobs.isEmpty()) return;
            var job = jobs.getFirst();
            UUID jobId = (UUID) job.get("id");
            long userId = ((Number) job.get("user_id_snapshot")).longValue();
            db.queryForList("select id from users where id=? for update", userId);
            db.update("update account_deletion_jobs set status='PROCESSING', updated_at=now() where id=?", jobId);
            try {
                Set<String> snapshot = json.readValue(job.get("object_keys").toString(), new TypeReference<LinkedHashSet<String>>() {});
                snapshot.addAll(keys(userId));
                db.update("update account_deletion_jobs set object_keys=cast(? as jsonb) where id=?", encode(snapshot), jobId);
                for (String key : snapshot) storage.deleteObject(b -> b.bucket(bucket).key(key));
            } catch (Exception e) {
                int attempts = ((Number) job.get("retry_count")).intValue() + 1;
                db.update("update account_deletion_jobs set status=?, retry_count=?, last_error='Object cleanup failed', updated_at=now() where id=?",
                        attempts >= maxAttempts ? "FAILED" : "RETRY", attempts, jobId);
                return;
            }
            db.update("delete from generated_packs where owner_id=?", userId);
            // Remaining ownership tables cascade; content_reports reporter is SET NULL.
            db.update("delete from users where id=?", userId);
            db.update("update account_deletion_jobs set status='COMPLETE', completed_at=now(), updated_at=now(), last_error=null, object_keys='[]'::jsonb where id=?", jobId);
        });
    }
}
