package icepunk_backend.model;
import jakarta.persistence.*; import java.time.OffsetDateTime; import java.util.UUID;
@Entity @Table(name="content_reports") public class ContentReport {
 @Id private UUID id=UUID.randomUUID(); @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="reporter_user_id") private User reporter;
 @Column(nullable=false) private String targetType; @Column(nullable=false) private String targetId; @Column(nullable=false) private String category;
 @Column(length=2000) private String description; @Column(nullable=false,length=16) private String noticeType; @Column(length=160) private String reporterName; @Column(length=320) private String reporterContactEmail; @Column(nullable=false) private boolean reporterGoodFaith; @Column(nullable=false) private String status="OPEN";
 @Column(nullable=false) private OffsetDateTime createdAt=OffsetDateTime.now(); @Column(nullable=false) private OffsetDateTime updatedAt=OffsetDateTime.now();
 public ContentReport(){} public ContentReport(User r,String t,String id,String c,String d,String type,String name,String contact,boolean goodFaith){reporter=r;targetType=t;targetId=id;category=c;description=d;noticeType=type;reporterName=name;reporterContactEmail=contact;reporterGoodFaith=goodFaith;}
 public UUID getId(){return id;}
}
