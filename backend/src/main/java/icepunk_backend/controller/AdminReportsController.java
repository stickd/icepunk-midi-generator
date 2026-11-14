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
import icepunk_backend.service.EmailService;

/** Access is restricted by SecurityConfig to the current database ADMIN role. */
@RestController
@RequestMapping("/admin/reports")
public class AdminReportsController {
    public enum Status { OPEN, REVIEWING, ACTIONED, REJECTED }
    public enum Category { COPYRIGHT, ILLEGAL_CONTENT, HARASSMENT, SPAM, OTHER }
    public enum TargetType { GENERATED_PACK, UPLOAD }
    public enum Action { NONE, HIDE, RESTORE }
    public record Update(@NotNull Status status, @Size(max=4000) String operatorNotes, Action action,
            @Size(max=4000) String decisionReason, @Size(max=1000) String decisionBasis, @Size(max=4000) String decisionFacts) {}
    private final JdbcTemplate db;
    private final EmailService email;
    private static final String FIELDS = "id, reporter_user_id, target_type, target_id, category, description, status, created_at, resolved_at, operator_notes, decision_reason, decision_basis, decision_facts, moderation_action, appeal_text, appealed_at";

    public AdminReportsController(JdbcTemplate db, EmailService email) { this.db = db; this.email = email; }

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
    @org.springframework.transaction.annotation.Transactional
    public Map<String, Object> update(@PathVariable UUID id, @Valid @RequestBody Update update) {
        boolean resolved = update.status() == Status.ACTIONED || update.status() == Status.REJECTED;
        Action action = update.action() == null ? Action.NONE : update.action();
        var matches = db.queryForList("select target_type,target_id,moderation_action,reporter_contact_email from content_reports where id=? for update", id);
        if (matches.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Report not found");
        var report = matches.get(0);
        if (resolved && (blank(update.decisionReason()) || blank(update.decisionBasis()) || blank(update.decisionFacts())))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A decision requires reasons, basis and facts");
        if (action == Action.HIDE && (update.status() != Status.ACTIONED || update.decisionReason() == null || update.decisionReason().isBlank()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Hiding requires an ACTIONED decision and a reason");
        if (action == Action.HIDE) {
            if ("GENERATED_PACK".equals(report.get("target_type"))) db.update("update generated_packs set visibility='PRIVATE',moderation_hidden=true where id=?", java.util.UUID.fromString((String) report.get("target_id")));
            else db.update("update user_uploaded_projects set visibility='PRIVATE',moderation_hidden=true where id=?", Long.valueOf((String) report.get("target_id")));
        }
        if (action == Action.RESTORE) {
            if (update.status() != Status.REJECTED || update.decisionReason() == null || update.decisionReason().isBlank())
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Restoration requires a reason and REJECTED status");
            int others = db.queryForObject("select count(*) from content_reports where target_type=? and target_id=? and moderation_action='HIDE' and id<>?", Integer.class,report.get("target_type"),report.get("target_id"),id);
            if (others == 0) {
                if ("GENERATED_PACK".equals(report.get("target_type"))) db.update("update generated_packs set moderation_hidden=false where id=?", UUID.fromString((String)report.get("target_id")));
                else db.update("update user_uploaded_projects set moderation_hidden=false where id=?",Long.valueOf((String)report.get("target_id")));
            }
        }
        if (resolved) db.update("update content_reports set decision_reason=?, decision_basis=?, decision_facts=? where id=?",
                update.decisionReason().trim(), update.decisionBasis().trim(), update.decisionFacts().trim(), id);
        int changed = db.update("update content_reports set status=?, moderation_action=?, operator_notes=coalesce(?,operator_notes), updated_at=now(), resolved_at=? where id=?",
                update.status().name(), action == Action.NONE ? report.get("moderation_action") : action.name(), update.operatorNotes(), resolved ? java.time.OffsetDateTime.now() : null, id);
        if (changed == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Report not found");
        var saved = db.queryForMap("select " + FIELDS + " from content_reports where id=?", id);
        if (resolved) {
            String statement = statement(update.decisionReason(), update.decisionBasis(), update.decisionFacts());
            if (action == Action.HIDE || action == Action.RESTORE) notifyOwner(report, update.status(), action, statement);
            notifyReporter(report, id, update.status(), action, statement);
        }
        return saved;
    }

    private void notifyOwner(Map<String, Object> report, Status status, Action action, String reason) {
        String ownerEmail;
        if ("GENERATED_PACK".equals(report.get("target_type"))) {
            ownerEmail = db.query("select u.email from generated_packs p join users u on u.id=p.owner_id where p.id=?",
                    result -> result.next() ? result.getString(1) : null, UUID.fromString((String) report.get("target_id")));
        } else {
            ownerEmail = db.query("select u.email from user_uploaded_projects p join users u on u.id=p.owner_id where p.id=?",
                    result -> result.next() ? result.getString(1) : null, Long.valueOf((String) report.get("target_id")));
        }
        if (ownerEmail == null) return;
        String decision = action == Action.HIDE ? "Content hidden" : action == Action.RESTORE ? "Restriction lifted"
                : status == Status.REJECTED ? "Report reviewed — no restriction" : status.name();
        try { email.sendModerationDecision(ownerEmail, (String) report.get("target_id"), decision,
                reason == null || reason.isBlank() ? "See your moderation page for details." : reason); }
        catch (RuntimeException ignored) { /* moderation result must never depend on mail delivery */ }
    }

    private void notifyReporter(Map<String, Object> report, UUID reportId, Status status, Action action, String reason) {
        String contact = (String) report.get("reporter_contact_email");
        if (contact == null || contact.isBlank()) return;
        String decision = action == Action.HIDE ? "Content hidden" : action == Action.RESTORE ? "Restriction lifted"
                : status == Status.REJECTED ? "Report reviewed — no restriction" : status.name();
        try { email.sendContentReportDecision(contact, reportId, decision,
                reason == null || reason.isBlank() ? "The report has been reviewed." : reason); }
        catch (RuntimeException ignored) { /* moderation result must never depend on mail delivery */ }
    }

    private static boolean blank(String value) { return value == null || value.isBlank(); }
    private static String statement(String reason, String basis, String facts) {
        return "Reason: " + reason.trim() + "\nBasis: " + basis.trim() + "\nFacts considered: " + facts.trim();
    }
}
