package icepunk_backend.service;
import icepunk_backend.dto.CreateContentReportRequest; import icepunk_backend.exception.ResourceNotFoundException; import icepunk_backend.model.*; import icepunk_backend.repository.*; import org.springframework.stereotype.Service; import java.util.*;
@Service public class ContentReportService {
 private final ContentReportRepository reports; private final GeneratedPackRepository packs; private final UserUploadedProjectRepository uploads;
 public ContentReportService(ContentReportRepository r,GeneratedPackRepository p,UserUploadedProjectRepository u){reports=r;packs=p;uploads=u;}
 public void create(User reporter,CreateContentReportRequest r){String type=r.targetType().trim().toUpperCase(Locale.ROOT), category=r.category().trim().toUpperCase(Locale.ROOT); if(!Set.of("GENERATED_PACK","UPLOAD").contains(type)||!Set.of("COPYRIGHT","ILLEGAL_CONTENT","HARASSMENT","SPAM","OTHER").contains(category)) throw new IllegalArgumentException("Invalid report.");
  boolean publicTarget = "GENERATED_PACK".equals(type) ? packs.findById(UUID.fromString(r.targetId())).map(p->p.getVisibility()==GeneratedPackVisibility.PUBLIC).orElse(false) : uploads.findById(Long.valueOf(r.targetId())).map(p->p.getVisibility()==UploadVisibility.PUBLIC).orElse(false);
  if(!publicTarget) throw new ResourceNotFoundException("Content not found"); reports.save(new ContentReport(reporter,type,r.targetId(),category,r.description())); }
}
