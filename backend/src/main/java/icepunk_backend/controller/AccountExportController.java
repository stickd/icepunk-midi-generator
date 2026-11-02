package icepunk_backend.controller;

import icepunk_backend.model.User;
import icepunk_backend.repository.UserRepository;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Exports only fields belonging to the authenticated account; no storage keys or credentials. */
@RestController
public class AccountExportController {
    private final UserRepository users;
    private final JdbcTemplate jdbc;

    public AccountExportController(UserRepository users, JdbcTemplate jdbc) {
        this.users = users;
        this.jdbc = jdbc;
    }

    @GetMapping("/account/export")
    public ResponseEntity<Map<String, Object>> export(Authentication authentication) {
        User user = users.findByEmail(authentication.getName()).orElseThrow();
        long id = user.getId();
        Map<String, Object> account = new LinkedHashMap<>();
        account.put("id", id);
        account.put("username", user.getUsername());
        account.put("email", user.getEmail());
        account.put("createdAt", user.getCreatedAt());
        account.put("verified", user.getVerified());
        account.put("bio", user.getBio());
        account.put("accountStatus", user.getAccountStatus());
        account.put("avatarPresent", user.getProfilePictureUrl() != null);
        account.put("avatarUrl", user.getProfilePictureUrl() == null ? null : "/users/" + id + "/avatar");
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("account", account);
        result.put("generatedPacks", jdbc.queryForList("select id, name, source_type, generation_type, bpm, pitch, octaves, amount, visibility, created_at, updated_at from generated_packs where owner_id = ?", id));
        result.put("generatedFiles", jdbc.queryForList("select i.id, i.pack_id, i.item_index, i.file_name, i.duration_seconds, i.note_count, i.track_count, i.min_pitch, i.max_pitch, i.avg_pitch, i.bpm, i.created_at from generated_pack_items i join generated_packs p on p.id=i.pack_id where p.owner_id=?", id));
        result.put("uploads", jdbc.queryForList("select id, title, uploaded_at, visibility, download_count, metadata->>'midiOriginalFilename' as filename, metadata->>'midiContentType' as content_type, metadata->>'midiSizeBytes' as size_bytes from user_uploaded_projects where owner_id = ?", id));
        result.put("samples", jdbc.queryForList("select id as upload_id, title, uploaded_at, metadata->>'sampleOriginalFilename' as filename, metadata->>'sampleContentType' as content_type, metadata->>'sampleSizeBytes' as size_bytes from user_uploaded_projects where owner_id=? and sample_object_key is not null", id));
        result.put("likes", jdbc.queryForList("select project_id, created_at from project_likes where user_id=?", id));
        result.put("submittedReports", jdbc.queryForList("select target_type, target_id, category, description, created_at from content_reports where reporter_user_id=?", id));
        result.put("datasetPresets", jdbc.queryForList("select id, name, source_midi_count, created_at from dataset_presets where owner_id = ?", id));
        result.put("legalAcceptances", jdbc.queryForList("select document_type, document_version, accepted_at from user_legal_acceptances where user_id = ?", id));
        return ResponseEntity.ok().header(HttpHeaders.CACHE_CONTROL, "no-store").header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"icepunk-data-export.json\"")
                .contentType(MediaType.APPLICATION_JSON).body(result);
    }
}
