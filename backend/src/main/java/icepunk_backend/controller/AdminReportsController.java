package icepunk_backend.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

/** Access is restricted by SecurityConfig to the current database ADMIN role. */
@RestController
@RequestMapping("/admin/reports")
public class AdminReportsController {
    public enum Status { OPEN, REVIEWING, ACTIONED, REJECTED }
    public enum Category { COPYRIGHT, ILLEGAL_CONTENT, HARASSMENT, SPAM, OTHER }
    public enum TargetType { GENERATED_PACK, UPLOAD }
    public record Update(@NotNull Status status, @Size(max=4000) String operatorNotes) {}
    private final JdbcTemplate db;
    private static final String FIELDS = "id, reporter_user_id, target_type, target_id, category, description, status, created_at, resolved_at, operator_notes";

    public AdminReportsController(JdbcTemplate db) { this.db = db; }

    @GetMapping
    public List<Map<String, Object>> list(@RequestParam(required=false) Status status,
            @RequestParam(required=false) Category category, @RequestParam(required=false) TargetType targetType,
            @RequestParam(defaultValue="0") int page) {
        if (page < 0 || page > 100000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        var sql = new StringBuilder("select " + FIELDS + " from content_reports where 1=1");
        var params = new java.util.ArrayList<Object>();
        if (status != null) { sql.append(" and status=?"); params.add(status.name()); }
        if (category != null) { sql.append(" and category=?"); params.add(category.name()); }
        if (targetType != null) { sql.append(" and target_type=?"); params.add(targetType.name()); }
        sql.append(" order by created_at desc, id limit 100 offset ?"); params.add(page * 100);
        return db.queryForList(sql.toString(), params.toArray());
    }

    @PatchMapping("/{id}")
    public Map<String, Object> update(@PathVariable UUID id, @Valid @RequestBody Update update) {
        boolean resolved = update.status() == Status.ACTIONED || update.status() == Status.REJECTED;
        int changed = db.update("update content_reports set status=?, operator_notes=coalesce(?,operator_notes), updated_at=now(), resolved_at=? where id=?",
                update.status().name(), update.operatorNotes(), resolved ? java.time.OffsetDateTime.now() : null, id);
        if (changed == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Report not found");
        return db.queryForMap("select " + FIELDS + " from content_reports where id=?", id);
    }
}
