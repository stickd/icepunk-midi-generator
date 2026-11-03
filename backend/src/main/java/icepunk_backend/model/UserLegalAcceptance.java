package icepunk_backend.model;
import jakarta.persistence.*; import java.time.OffsetDateTime;
@Entity @Table(name="user_legal_acceptances") public class UserLegalAcceptance {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(optional=false) @JoinColumn(name="user_id") private User user;
 @Column(nullable=false) private String documentType; @Column(nullable=false) private String documentVersion;
 @Column(nullable=false) private OffsetDateTime acceptedAt=OffsetDateTime.now();
 public UserLegalAcceptance(){} public UserLegalAcceptance(User u,String t,String v){user=u;documentType=t;documentVersion=v;}
 public String getDocumentType(){return documentType;} public String getDocumentVersion(){return documentVersion;} public OffsetDateTime getAcceptedAt(){return acceptedAt;}
}
