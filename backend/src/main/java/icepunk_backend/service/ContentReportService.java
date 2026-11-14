package icepunk_backend.service;
import icepunk_backend.dto.CreateContentReportRequest; import icepunk_backend.exception.ResourceNotFoundException; import icepunk_backend.model.*; import icepunk_backend.repository.*; import org.springframework.stereotype.Service; import java.util.*;
@Service public class ContentReportService {
 private final ContentReportRepository reports; private final GeneratedPackRepository packs; private final UserUploadedProjectRepository uploads; private final EmailService email;
 public ContentReportService(ContentReportRepository r,GeneratedPackRepository p,UserUploadedProjectRepository u,EmailService email){reports=r;packs=p;uploads=u;this.email=email;}
 public UUID create(User reporter,CreateContentReportRequest r){String type=r.targetType().trim().toUpperCase(Locale.ROOT), category=r.category().trim().toUpperCase(Locale.ROOT); if(!Set.of("GENERATED_PACK","UPLOAD").contains(type)||!Set.of("COPYRIGHT","ILLEGAL_CONTENT","HARASSMENT","SPAM","OTHER").contains(category)) throw new IllegalArgumentException("Invalid report.");
  boolean publicTarget; try { publicTarget = "GENERATED_PACK".equals(type) ? packs.findById(UUID.fromString(r.targetId())).map(p->p.getVisibility()==GeneratedPackVisibility.PUBLIC).orElse(false) : uploads.findById(Long.valueOf(r.targetId())).map(p->p.getVisibility()==UploadVisibility.PUBLIC).orElse(false); } catch (IllegalArgumentException e) { throw new ResourceNotFoundException("Content not found"); }
  if(!publicTarget) throw new ResourceNotFoundException("Content not found"); String noticeType=r.noticeType().trim().toUpperCase(Locale.ROOT); String contact=r.contactEmail()==null||r.contactEmail().isBlank()?null:r.contactEmail().trim().toLowerCase(Locale.ROOT); String name=r.reporterName()==null||r.reporterName().isBlank()?null:r.reporterName().trim();
  if(!Boolean.TRUE.equals(r.goodFaith())) throw new IllegalArgumentException("A good-faith declaration is required.");
  if("FORMAL_DSA".equals(noticeType) && (name==null || contact==null)) throw new IllegalArgumentException("A formal DSA notice requires a name and contact email.");
  UUID id=reports.save(new ContentReport(reporter,type,r.targetId(),category,r.description(),noticeType,name,contact,true)).getId();
  if(contact!=null) try { email.sendContentReportReceipt(contact,id); } catch(RuntimeException ignored) { /* receipt remains available in the UI */ }
  return id; }
}
