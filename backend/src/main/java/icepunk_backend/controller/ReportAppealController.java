package icepunk_backend.controller;
import icepunk_backend.repository.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/reports")
public class ReportAppealController {
    private final JdbcTemplate db;
    private final UserRepository users;
    public ReportAppealController(JdbcTemplate db,UserRepository users){this.db=db;this.users=users;}
    public record Appeal(@NotBlank @Size(max=2000) String text){}
    private static final String OWNED = "((r.target_type='GENERATED_PACK' and exists(select 1 from generated_packs p where cast(p.id as text)=r.target_id and p.owner_id=?)) or (r.target_type='UPLOAD' and exists(select 1 from user_uploaded_projects p where cast(p.id as text)=r.target_id and p.owner_id=?)))";
    @GetMapping("/mine")
    public List<Map<String,Object>> mine(Authentication a) {
        var u=users.findByEmail(a.getName()).orElseThrow();
        return db.queryForList("select r.id,r.target_type,r.target_id,r.status,r.decision_reason,r.moderation_action,r.appeal_text,r.appealed_at from content_reports r where r.moderation_action IN ('HIDE','RESTORE') and "+OWNED+" order by r.created_at desc",u.getId(),u.getId());
    }
    @PostMapping("/{id}/appeal")
    public ResponseEntity<Void> appeal(@PathVariable UUID id,Authentication a,@Valid @RequestBody Appeal body){
        var u=users.findByEmail(a.getName()).orElseThrow();
        int n=db.update("update content_reports r set appeal_text=?, appealed_at=now(), status='REVIEWING', resolved_at=null, updated_at=now() where r.id=? and r.moderation_action='HIDE' and r.appealed_at is null and "+OWNED,body.text().trim(),id,u.getId(),u.getId());
        return n==0?ResponseEntity.notFound().build():ResponseEntity.accepted().build();
    }
}
