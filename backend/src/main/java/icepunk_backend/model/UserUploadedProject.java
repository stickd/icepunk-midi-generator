package icepunk_backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@Entity
@Table(name = "user_uploaded_projects")
public class UserUploadedProject {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(nullable = false, unique = true, length = 1024)
    private String midiObjectKey;

    @Column(length = 1024)
    private String sampleObjectKey;

    @Column(nullable = false)
    private OffsetDateTime uploadedAt = OffsetDateTime.now();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private UploadVisibility visibility = UploadVisibility.PRIVATE;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> metadata = new LinkedHashMap<>();

    public Long getId() {
        return id;
    }

    public User getOwner() {
        return owner;
    }

    public String getTitle() {
        return title;
    }

    public String getMidiObjectKey() {
        return midiObjectKey;
    }

    public String getSampleObjectKey() {
        return sampleObjectKey;
    }

    public OffsetDateTime getUploadedAt() {
        return uploadedAt;
    }

    public UploadVisibility getVisibility() {
        return visibility;
    }

    public Map<String, Object> getMetadata() {
        return metadata;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public void setOwner(User owner) {
        this.owner = owner;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public void setMidiObjectKey(String midiObjectKey) {
        this.midiObjectKey = midiObjectKey;
    }

    public void setSampleObjectKey(String sampleObjectKey) {
        this.sampleObjectKey = sampleObjectKey;
    }

    public void setUploadedAt(OffsetDateTime uploadedAt) {
        this.uploadedAt = uploadedAt;
    }

    public void setVisibility(UploadVisibility visibility) {
        this.visibility = visibility;
    }

    public void setMetadata(Map<String, Object> metadata) {
        this.metadata = metadata;
    }
}
